# Security and privacy

Working Print has no account, image upload endpoint, analytics or third-party browser dependencies. It loads static assets from its own host. Selected photographs remain in browser memory; only recipes are saved to local storage. Export produces a fresh image without copying original EXIF/GPS. Visible image content can still reveal sensitive information.

The application accepts JPEG, PNG and WebP up to 20 MB, 12 MP and 16,000 pixels per edge. Dimensions can be checked only after browser decoding. These limits reduce work after decode but cannot eliminate codec vulnerabilities or memory exhaustion. Keep your browser and Python imaging dependencies updated. Use trusted local files when running the reference CLI.

Recipes are data, never executed. The validator rejects unknown keys, unsupported versions, nonnumeric/nonfinite values and unordered curves. Filenames are rendered with textContent, not inserted as HTML. JSON imports are limited to 32 KB. The CLI refuses existing output paths.

The supplied development server binds to `127.0.0.1` and is for local use. Publish the contents of `dist/`, not a working directory containing source, tests or personal files. No credentials are required.

Report a vulnerability privately to caetanoitalo60@gmail.com with reproduction steps. Avoid sending personal photographs; use a synthetic fixture where possible. There is no guaranteed response SLA for this personal project.
