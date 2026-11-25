# Study guide

You should be able to explain the pixel pipeline and prove its behavior with small examples before presenting this project.

## Read in this order

1. `examples/soft-print.json`: identify units, bounds and why a curve needs ordered points.
2. `engine.mjs`: trace one RGB byte triplet through linearization, gain, encoding, saturation, contrast and curve.
3. `tests/engine.test.mjs`: predict each assertion before running it.
4. `worker.mjs` and `app.mjs`: follow ownership of a typed array and why an obsolete preview must not overwrite a new one.
5. `python/render.py`: compare a per-pixel loop with NumPy broadcasting. Explain why both can implement the same equations.

## Foundations

The image is a flat RGBA typed array in JavaScript and an H×W×4 array in Python. A lookup table is an array indexed by an input byte. A histogram is a fixed-size frequency table. There is no need for a tree or database for this problem.

The engine is linear in pixel count. Reducing both dimensions by half reduces work by roughly four, rather than two. A 12 MP RGBA array needs about 48 MB; original, copied input and output allocations can multiply that. A file's compressed size does not describe its decoded memory requirement.

A monotonic curve guarantees that an input brightness ordering is not reversed by the curve alone. It does not make the full saturation/contrast pipeline perceptually uniform or prevent clipping.

## Questions for a technical review

- Why does exposure operate before sRGB encoding, while contrast uses encoded channels?
- What does the neutral recipe prove? What can it fail to prove?
- Why is the original buffer immutable? What would happen if each slider change modified the preceding output?
- How do transferable buffers differ from copying an array into a worker?
- What does the stale-response generation counter protect? Does it cancel expensive running computation?
- How can a monotonic curve still create visible banding?
- Why compare decoded arrays for parity instead of complete PNG bytes?
- How do transparent pixels affect a histogram? Why is alpha copied rather than processed as colour?
- Why is warmth not labelled Kelvin? What additional data would physical calibration require?
- What privacy remains after EXIF stripping? Can visible content itself reveal a location?
- Why can a 20 MB limit fail to protect against a decompression bomb until after decode?
- What would need to change before allowing untrusted image uploads to a server?

## Exercises

1. **Trace three pixels.** Use black, middle grey and saturated red. Compute an EV +1 transform by hand and compare with the test runner.
2. **Break the curve.** Change the validator to accept descending values. Construct a grayscale ramp showing tonal reversal, then restore validation and add a rejection case.
3. **Add a tested operator.** Implement an optional invert transformation in both engines. Version the recipe rather than silently changing the meaning of version 1. Extend parity fixtures.
4. **Control the queue.** Allow only one running preview and replace pending work with the newest request. Explain why stale response rejection alone does not reclaim CPU.
5. **Prove a privacy property.** Create a JPEG containing known GPS/EXIF fields, export it in the browser and inspect the output with ExifTool. Document which metadata the browser encoder adds.
6. **Investigate performance.** Time the pure engine at 0.25, 1 and 4 MP on your device. Record actual measurements and device details; do not treat processing time as a universal claim.
7. **Extend curve interpolation.** Implement monotone cubic interpolation and test monotonicity densely. Compare smoothness and complexity against the current piecewise-linear mapping.

## Honest presentation

This project was built with AI coding assistance and human-directed requirements. The repository documents the actual assistance and available checks. Do not claim that writing a study guide proves personal mastery: complete the exercises, make a change yourself and explain the tradeoffs in your own words.
