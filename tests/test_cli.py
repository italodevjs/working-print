import json
from pathlib import Path
import subprocess
import sys
from PIL import Image

ROOT=Path(__file__).parents[1]

def invoke(source,recipe,output):
    return subprocess.run([sys.executable,str(ROOT/'python/render.py'),str(source),str(recipe),str(output)],capture_output=True,text=True)

def test_cli_normalizes_orientation_strips_metadata_and_preserves_source(tmp_path):
    source=tmp_path/'source.jpg'
    exif=Image.Exif()
    exif[274]=6
    exif[271]='Test camera identity'
    Image.new('RGB',(6,4),(70,110,150)).save(source,exif=exif)
    original=source.read_bytes()
    output=tmp_path/'output.png'
    result=invoke(source,ROOT/'examples/soft-print.json',output)
    assert result.returncode==0,result.stderr
    with Image.open(output) as image:
        assert image.size==(4,6)
        assert len(image.getexif())==0
        assert image.getpixel((0,0))[:3]!=(70,110,150)
    assert source.read_bytes()==original
    exported=output.read_bytes()
    assert invoke(source,ROOT/'examples/soft-print.json',output).returncode!=0
    assert output.read_bytes()==exported

def test_cli_missing_recipe_is_a_clear_error_without_traceback(tmp_path):
    source=tmp_path/'input.png'
    Image.new('RGB',(2,2)).save(source)
    result=invoke(source,tmp_path/'missing.json',tmp_path/'output.png')
    assert result.returncode!=0
    assert 'error:' in result.stderr
    assert 'Traceback' not in result.stderr

def test_cli_rejects_bad_recipe_without_writing_output(tmp_path):
    source=tmp_path/'input.png'
    Image.new('RGBA',(2,2),(12,34,56,78)).save(source)
    recipe=tmp_path/'bad.json'
    recipe.write_text(json.dumps({'schema':'working-print','version':2,'adjustments':{}}))
    output=tmp_path/'output.png'
    result=invoke(source,recipe,output)
    assert result.returncode!=0
    assert not output.exists()
