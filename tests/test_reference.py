import importlib.util
from pathlib import Path
import numpy as np
import pytest
spec=importlib.util.spec_from_file_location('render',Path(__file__).parents[1]/'python/render.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def test_neutral_and_alpha():
    pixels=np.arange(256,dtype=np.uint8).reshape(8,8,4)
    assert np.array_equal(module.render_rgba(pixels,module.DEFAULTS),pixels)

@pytest.mark.parametrize('bad',[float('nan'),float('inf'),True,'1',4])
def test_invalid_exposure(bad):
    with pytest.raises(ValueError):
        module.validate_recipe(dict(schema='working-print',version=1,adjustments={**module.DEFAULTS,'exposure':bad}))

def test_reject_unknown_and_curve_inversion():
    for a in [{**module.DEFAULTS,'unexpected':1},{**module.DEFAULTS,'curve':[0,.9,.2,.7,1]}]:
        with pytest.raises(ValueError):
            module.render_rgba(np.zeros((1,1,4),dtype=np.uint8),a)
