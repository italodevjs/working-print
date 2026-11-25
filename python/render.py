"""Working Print reference renderer. Matches the browser's encoded pixel math."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps

DEFAULTS = dict(exposure=0, contrast=0, warmth=0, tint=0, saturation=0, curve=[0, .25, .5, .75, 1])
LIMITS = dict(exposure=(-3,3), contrast=(-70,70), warmth=(-100,100), tint=(-100,100), saturation=(-100,100))

def validate_recipe(value: dict) -> dict:
    if not isinstance(value,dict) or set(value)!={'schema','version','adjustments'} or value['schema']!='working-print' or type(value['version']) is not int or value['version']!=1:
        raise ValueError('Expected a Working Print version 1 recipe.')
    a=value['adjustments']
    if not isinstance(a,dict) or set(a)!=set(DEFAULTS):
        raise ValueError('Missing or unknown adjustments.')
    for key,(lo,hi) in LIMITS.items():
        if type(a[key]) not in (int,float) or not np.isfinite(a[key]) or not lo<=a[key]<=hi:
            raise ValueError(f'{key} must be between {lo} and {hi}.')
    curve=a['curve']
    if not isinstance(curve,list) or len(curve)!=5 or any(type(v) not in (int,float) or not np.isfinite(v) or not 0<=v<=1 for v in curve) or curve[0]!=0 or curve[-1]!=1 or any(x>y for x,y in zip(curve,curve[1:])):
        raise ValueError('The curve needs five increasing values from 0 to 1.')
    return a

def render_rgba(pixels: np.ndarray, adjustments: dict) -> np.ndarray:
    a=validate_recipe(dict(schema='working-print',version=1,adjustments=adjustments))
    if pixels.dtype!=np.uint8 or pixels.ndim!=3 or pixels.shape[2]!=4:
        raise ValueError('Expected an H×W×4 uint8 array.')
    rgb=pixels[...,:3].astype(np.float64)/255
    linear=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
    w,t=a['warmth']/100,a['tint']/100
    linear=np.clip(linear*(2**a['exposure'])*np.array([1+.22*w+.08*t,1-.12*t,1-.22*w+.08*t]),0,1)
    display=np.where(linear<=.0031308,linear*12.92,1.055*linear**(1/2.4)-.055)
    luminance=(display*np.array([.2126,.7152,.0722])).sum(axis=2,keepdims=True)
    display=luminance+(display-luminance)*(1+a['saturation']/100)
    display=np.clip((display-.5)*(2**(a['contrast']/50))+.5,0,1)
    output=np.empty_like(pixels)
    output[...,:3]=np.floor(np.interp(display,[0,.25,.5,.75,1],a['curve'])*255+.5).astype(np.uint8)
    output[...,3]=pixels[...,3]
    return output

def main() -> None:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input',type=Path)
    parser.add_argument('recipe',type=Path)
    parser.add_argument('output',type=Path,help='New PNG output; existing files are never overwritten.')
    args=parser.parse_args()
    if args.output.suffix.lower()!='.png':
        parser.error('Output must end in .png.')
    if args.output.exists():
        parser.error('Output already exists. Choose a new filename.')
    try:
        if args.recipe.stat().st_size>32768:
            raise ValueError('Recipe exceeds 32 KB.')
        if args.input.stat().st_size>20*1024*1024:
            raise ValueError('Image exceeds 20 MB.')
        a=validate_recipe(json.loads(args.recipe.read_text('utf-8')))
        with Image.open(args.input) as source:
            if source.format not in ('JPEG','PNG','WEBP'):
                raise ValueError('Choose JPEG, PNG or WebP.')
            if source.width*source.height>12_000_000 or max(source.size)>16000:
                raise ValueError('Image exceeds 12 MP or a 16,000-pixel edge.')
            # Normalize an embedded source profile before the shared pixel math.
            if source.info.get('icc_profile'):
                from PIL import ImageCms
                import io
                profile=ImageCms.ImageCmsProfile(io.BytesIO(source.info['icc_profile']))
                rgb=ImageCms.profileToProfile(ImageOps.exif_transpose(source).convert('RGB'),profile,ImageCms.createProfile('sRGB'),outputMode='RGB')
                image=rgb.convert('RGBA')
                alpha=ImageOps.exif_transpose(source).convert('RGBA').getchannel('A')
                image.putalpha(alpha)
            else:
                image=ImageOps.exif_transpose(source).convert('RGBA')
            output=render_rgba(np.asarray(image),a)
            # New image deliberately does not inherit EXIF, GPS, comments or device tags.
            with args.output.open('xb') as destination:
                Image.fromarray(output).save(destination,format='PNG')
        print(f'Rendered {output.shape[1]} × {output.shape[0]} pixels to {args.output}')
    except (ValueError,OSError,json.JSONDecodeError) as exc:
        parser.error(str(exc))

if __name__=='__main__':
    main()
