---
name: tool-pyheif
description: Load when working with pyheif, HEIC decoding, HEIF containers, libheif CFFI bindings, Pillow conversion, or iPhone image ingestion. Covers API surface, setup, error handling, and lessons.
triggers:
  bash: []
---

# pyheif

## What it is

`pyheif` is a Python library that exposes libheif through CFFI for decoding HEIF/HEIC/AVIF container data into Python objects and raw pixel bytes. Reach for it when the task is read-only HEIC ingestion, primary-image extraction, metadata access, or conversion into Pillow objects; use `pillow-heif` when HEIF encoding, Pillow plugin registration, or newer wheel/platform support is required. No Bash CLI exists; this skill loads explicitly only until a Python-import trigger is added.

## Capability surface

### CLI surface

None. `pyheif` is an import-only Python package.

### Top-level module: `pyheif`

`pyheif.__init__` imports public names from `pyheif.constants`, `pyheif.reader`, and `pyheif.writer`, then defines version helpers.

| Name | Kind | Signature / value | Notes |
|---|---|---|---|
| `__version__` | string | read from bundled `data/version.txt` | Installed package version. |
| `libheif_version` | function | `libheif_version() -> str` | Returns `heif_get_version()` decoded from libheif. |
| `check` | function | `check(fp) -> int` | Reads first 12 bytes and returns libheif file type check constant. |
| `read_heif` | function | `read_heif(fp, apply_transformations=True)` | Deprecated; warns `read_heif is deprecated, use read() instead`; calls `read()`. |
| `read` | function | `read(fp, *, apply_transformations=True, convert_hdr_to_8bit=True) -> HeifImage` | Opens the primary image and decodes immediately. |
| `open` | function | `open(fp, *, apply_transformations=True, convert_hdr_to_8bit=True) -> UndecodedHeifImage | HeifImage` | Opens container and returns the primary image object without forcing decode. |
| `open_container` | function | `open_container(fp, *, apply_transformations=True, convert_hdr_to_8bit=True) -> HeifContainer` | Opens full HEIF container with top-level/depth/auxiliary image structure. |
| `HeifImage` | class | `HeifImage(**kwargs)` | Decoded image object. Constructor is internal; use `read()` or `.load()`. |
| `UndecodedHeifImage` | class | `UndecodedHeifImage(heif_handle, ctx, *, apply_transformations, convert_hdr_to_8bit, **kwargs)` | Lazy image object; `load()` decodes and changes object class to `HeifImage`. |
| `HeifFile` | alias | `HeifFile = HeifImage` | Deprecated alias; marked for removal in 1.0. |
| `UndecodedHeifFile` | alias | `UndecodedHeifFile = UndecodedHeifImage` | Deprecated alias; marked for removal in 1.0. |
| `HeifContainer` | class | `HeifContainer(primary_image, top_level_images)` | Container-level view. |
| `HeifTopLevelImage` | class | `HeifTopLevelImage(id, image, is_primary, depth_image, auxiliary_images)` | Top-level image wrapper. |
| `HeifDepthImage` | class | `HeifDepthImage(id, image)` | Depth-image wrapper. |
| `HeifAuxiliaryImage` | class | `HeifAuxiliaryImage(id, type, image)` | Auxiliary-image wrapper. |
| `HeifError` | exception | `HeifError(*, code, subcode, message)` | Raised when libheif returns non-zero error code. |
| `HeifNoImageError` | exception | `HeifNoImageError()` | Raised when container has zero top-level images. |

### Accepted `fp` / `path_or_bytes` inputs

`read()`, `open()`, `open_container()`, `read_heif()`, and `check()` accept:

| Input type | Handling |
|---|---|
| `str` path | Opened in binary mode and read. |
| `pathlib.Path` | Opened in binary mode and read. |
| file-like object | `.read()` is called; `length` is honored where used by `check()`. |
| `bytes` / `bytearray` / bytes-convertible object | Coerced with `bytes(fp)`; sliced to `length` where used by `check()`. |

### Function parameters

| Parameter | Applies to | Default | Meaning |
|---|---|---:|---|
| `apply_transformations` | `read_heif`, `read`, `open`, `open_container` | `True` | Apply HEIF transform properties such as rotation, mirror, crop, and image-size transformations when decoding and reporting dimensions. |
| `convert_hdr_to_8bit` | `read`, `open`, `open_container` | `True` | Convert >8-bit component data to 8-bit interleaved output. When `False`, higher bit-depth data is exposed as 16-bit big-endian interleaved bytes for supported RGB/RGBA modes. |

### Objects

#### `HeifImage`

Decoded image data object.

| Attribute / method | Type | Meaning |
|---|---|---|
| `mode` | `str` | Image mode, usually `"RGB"` or `"RGBA"`. |
| `size` | `tuple[int, int]` | `(width, height)`. |
| `data` | `bytes` | Raw decoded pixel bytes. |
| `stride` | `int` | Bytes per decoded row. |
| `metadata` | `list[dict]` | Metadata dictionaries extracted from the HEIF image. |
| `color_profile` | `dict | None` | Color profile data. |
| `bit_depth` | `int` | Bits per component. |
| `has_alpha` | `bool` | Whether an alpha channel exists. |
| `transformations` | list-like | HEIF transformations discovered for the image. |
| `load()` | method | Returns `self`; object is already decoded. |
| `close()` | method | Frees retained decoded data reference where present. |

#### `UndecodedHeifImage`

Lazy image object returned by `open()` and used inside containers.

| Attribute / method | Type | Meaning |
|---|---|---|
| `mode`, `size`, `metadata`, `color_profile`, `bit_depth`, `has_alpha`, `transformations` | same as `HeifImage` | Metadata/properties available before full pixel decode. |
| `data` | `None` until decoded | Pixel data absent before `load()`. |
| `stride` | `None` until decoded | Row stride absent before `load()`. |
| `apply_transformations` | `bool` | Stored decode option. |
| `convert_hdr_to_8bit` | `bool` | Stored decode option. |
| `load()` | method | Decodes pixel data, releases libheif handles, changes class to `HeifImage`, returns `self`. |
| `close()` | method | Releases retained libheif handle/context references. |

#### `HeifContainer`

| Attribute | Type | Meaning |
|---|---|---|
| `primary_image` | `HeifTopLevelImage` | Primary image in the file. |
| `top_level_images` | `list[HeifTopLevelImage]` | All top-level image items in the file. |

#### `HeifTopLevelImage`

| Attribute | Type | Meaning |
|---|---|---|
| `id` | `int` | HEIF item ID. |
| `image` | `UndecodedHeifImage | HeifImage` | Underlying image object. |
| `is_primary` | `bool` | Whether this item is the primary image. |
| `depth_image` | `HeifDepthImage | None` | Associated depth image, if present. |
| `auxiliary_images` | `list[HeifAuxiliaryImage]` | Associated auxiliary images. |

#### `HeifDepthImage`

| Attribute | Type | Meaning |
|---|---|---|
| `id` | `int` | HEIF item ID. |
| `image` | `UndecodedHeifImage | HeifImage` | Depth image object. |

#### `HeifAuxiliaryImage`

| Attribute | Type | Meaning |
|---|---|---|
| `id` | `int` | HEIF item ID. |
| `type` | `str` | Auxiliary image type string. |
| `image` | `UndecodedHeifImage | HeifImage` | Auxiliary image object. |

### Exceptions

| Exception | String form | Cause |
|---|---|---|
| `ValueError` | `Input is not a HEIF/AVIF file` | File type check returned `heif_filetype_no`. |
| `UserWarning` | `Input is an unsupported HEIF/AVIF file type - trying anyway!` | File type check returned `heif_filetype_yes_unsupported`; decode continues. |
| `HeifNoImageError` | `Heif file contains no images` | Container reports zero top-level images. |
| `HeifError` | `Code: {code}, Subcode: {subcode}, Message: "{message}"` | Any libheif operation returned non-zero error code. |

### Constants re-exported from `pyheif.constants`

Use these values to interpret `check(fp)` and lower-level libheif-derived attributes.

| Name | Value |
|---|---:|
| `heif_chroma_undefined` | `99` |
| `heif_chroma_monochrome` | `0` |
| `heif_chroma_420` | `1` |
| `heif_chroma_422` | `2` |
| `heif_chroma_444` | `3` |
| `heif_chroma_interleaved_RGB` | `10` |
| `heif_chroma_interleaved_RGBA` | `11` |
| `heif_chroma_interleaved_RRGGBB_BE` | `12` |
| `heif_chroma_interleaved_RRGGBBAA_BE` | `13` |
| `heif_colorspace_undefined` | `99` |
| `heif_colorspace_YCbCr` | `0` |
| `heif_colorspace_RGB` | `1` |
| `heif_colorspace_monochrome` | `2` |
| `heif_channel_Y` | `0` |
| `heif_channel_Cb` | `1` |
| `heif_channel_Cr` | `2` |
| `heif_channel_R` | `3` |
| `heif_channel_G` | `4` |
| `heif_channel_B` | `5` |
| `heif_channel_Alpha` | `6` |
| `heif_channel_interleaved` | `10` |
| `heif_color_profile_type_not_present` | `0` |
| `heif_color_profile_type_nclx` | `encode_fourcc("nclx")` |
| `heif_color_profile_type_rICC` | `encode_fourcc("rICC")` |
| `heif_color_profile_type_prof` | `encode_fourcc("prof")` |
| `heif_filetype_no` | `0` |
| `heif_filetype_yes_supported` | `1` |
| `heif_filetype_yes_unsupported` | `2` |
| `heif_filetype_maybe` | `3` |
| `heif_item_property_type_user_description` | `encode_fourcc("udes")` |
| `heif_item_property_type_transform_mirror` | `encode_fourcc("imir")` |
| `heif_item_property_type_transform_rotation` | `encode_fourcc("irot")` |
| `heif_item_property_type_transform_crop` | `encode_fourcc("clap")` |
| `heif_item_property_type_image_size` | `encode_fourcc("ispe")` |
| `heif_transform_mirror_direction_vertical` | `0` |
| `heif_transform_mirror_direction_horizontal` | `1` |
| `LIBHEIF_AUX_IMAGE_FILTER_OMIT_ALPHA` | `0x2` |
| `LIBHEIF_AUX_IMAGE_FILTER_OMIT_DEPTH` | `0x4` |

| Helper | Signature | Meaning |
|---|---|---|
| `encode_fourcc` | `encode_fourcc(fourcc)` | Encodes a 4-character code into an integer by shifting bytes. |

### Writing / encoding

Not supported as public functionality. The package imports `writer`, but upstream documents: `Note: currently only reading is supported.`

## Setup & auth

Install from PyPI on manylinux-compatible Linux:

```bash
python -m pip install --upgrade pip
python -m pip install pyheif
```

Source build on macOS:

```bash
brew install libffi libheif
python -m pip install git+https://github.com/carsales/pyheif.git
```

Source build on Debian/Ubuntu Linux:

```bash
sudo apt install libffi libheif-dev libde265-dev
python -m pip install git+https://github.com/carsales/pyheif.git
```

Source build on yum-based Linux:

```bash
sudo yum install libffi libheif-devel libde265-devel
python -m pip install git+https://github.com/carsales/pyheif.git
```

Windows source build: unsupported by upstream.

State/auth:

| Item | Location / requirement |
|---|---|
| Credentials | None. |
| Config files | None. |
| Runtime state | None beyond Python package files and dynamic library loading. |
| Native dependencies | `libheif`, `libffi`, `libde265`; headers required for source builds. |
| Wheel coverage | PyPI wheels target manylinux-style Linux; Alpine/musl and Windows require alternate tooling or a different library. |

## Common workflows

Read the primary image into raw bytes:

```python
import pyheif

heif_image = pyheif.read("IMG_7424.HEIC")
print(heif_image.mode, heif_image.size, heif_image.stride, heif_image.bit_depth)
raw = heif_image.data
```

Output: decoded primary image metadata and raw interleaved pixel bytes.

Convert HEIC to JPEG through Pillow:

```python
from PIL import Image
import pyheif

heif_image = pyheif.read("IMG_7424.HEIC")
image = Image.frombytes(
    heif_image.mode,
    heif_image.size,
    heif_image.data,
    "raw",
    heif_image.mode,
    heif_image.stride,
)
image.save("IMG_7424.jpg", "JPEG")
```

Output: `IMG_7424.jpg` written through Pillow.

Read HEIF content already held in memory:

```python
import pyheif

with open("IMG_7424.HEIC", "rb") as f:
    payload = f.read()

heif_image = pyheif.read(payload)
```

Output: decoded primary image without passing a filesystem path to `pyheif`.

Inspect a full container lazily:

```python
import pyheif

container = pyheif.open_container("IMG_7424.HEIC")
print(container.primary_image.id)
for item in container.top_level_images:
    print(item.id, item.is_primary, item.depth_image is not None, len(item.auxiliary_images))
    decoded = item.image.load()
```

Output: top-level image/depth/auxiliary structure; pixel decode occurs at `.load()`.

Check support and libheif version:

```python
import pyheif

print(pyheif.libheif_version())
print(pyheif.check("IMG_7424.HEIC"))
```

Output: linked libheif version and numeric `heif_filetype_*` result.

## Error handling

| Symptom | Likely cause | Fix |
|---|---|---|
| `ValueError: Input is not a HEIF/AVIF file` | First bytes do not pass libheif file type check. | Verify the path/bytes, reject non-HEIF input, or preflight with `pyheif.check(fp)`. |
| `UserWarning: Input is an unsupported HEIF/AVIF file type - trying anyway!` | libheif reported `heif_filetype_yes_unsupported`. | Continue only if decode succeeds; otherwise update libheif or switch to `pillow-heif` with newer bundled wheels. |
| `Heif file contains no images` | Container has zero top-level images. | Treat as invalid for image ingestion; inspect with `heif-info`, `exiftool`, or the producer pipeline. |
| `Code: {code}, Subcode: {subcode}, Message: "{message}"` | libheif returned a decode/read error. | Preserve the exact message, check `pyheif.libheif_version()`, update libheif/pyheif, and test the file with libheif tools. |
| `_libheif_cffi.c(570): fatal error C1083: Cannot open include file: 'libheif/heif.h': No such file or directory` | Source build cannot find libheif headers, commonly on Windows or incomplete native setup. | Install `libheif-dev`/`libheif-devel` on supported platforms or avoid pyheif on Windows. |
| `ffi.error: struct heif_decoding_options: wrong total size (cdef says 48, but C compiler says 72).` | CFFI declarations and compiled libheif ABI are mismatched. | Use a compatible wheel, rebuild against the exact installed libheif, or align pyheif/libheif versions. |
| `read_heif is deprecated, use read() instead` | Deprecated API alias used. | Replace `pyheif.read_heif(fp, ...)` with `pyheif.read(fp, ...)`. |

## Traps

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command when something bites._

## Lessons

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command for behaviors learned that aren't in upstream docs._
