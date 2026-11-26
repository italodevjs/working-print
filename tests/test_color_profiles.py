import importlib.util
from pathlib import Path
import pytest
from PIL import Image, ImageCms

spec = importlib.util.spec_from_file_location('render_color', Path(__file__).parents[1] / 'python/render.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def test_lab_profile_uses_original_channels_before_conversion():
    source = Image.new('LAB', (1, 1), (255, 128, 128))
    source.info['icc_profile'] = ImageCms.ImageCmsProfile(ImageCms.createProfile('LAB')).tobytes()
    result = module.normalize_image(source)
    assert result.mode == 'RGBA'
    assert min(result.getpixel((0, 0))[:3]) >= 250

def test_profile_conversion_preserves_original_alpha():
    source = Image.new('RGBA', (1, 1), (80, 120, 160, 37))
    source.info['icc_profile'] = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
    assert module.normalize_image(source).getpixel((0, 0))[3] == 37

def test_invalid_profile_fails_explicitly():
    source = Image.new('RGB', (1, 1))
    source.info['icc_profile'] = b'not-a-profile'
    with pytest.raises((OSError, ImageCms.PyCMSError)):
        module.normalize_image(source)
