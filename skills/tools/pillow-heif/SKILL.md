---
name: tool-pillow-heif
description: Load when working with pillow-heif, HEIC decoding, HEIF encoding, Pillow plugin registration, libheif options, or iPhone image conversion. Covers API surface, setup, error handling, and lessons.
triggers:
  bash: []
---

# pillow-heif

## What it is

`pillow-heif` is a Python library and Pillow plugin for reading and writing HEIF/HEIC images through libheif. Reach for it when the task needs HEIF decoding, HEIF encoding, Pillow `Image.open()`/`Image.save()` integration, multi-image HEIF containers, metadata preservation, thumbnails, depth images, or 10/12-bit image handling; use `pyheif` for older read-only CFFI workflows. No Bash CLI exists; this skill loads explicitly only until a Python-import trigger is added.

## Capability surface

### CLI surface

None. `pillow-heif` is an import-only Python package.

### Top-level module: `pillow_heif`

| Name | Kind | Signature / value | Notes |
|---|---|---|---|
| `__version__` | string | package version | Installed `pillow-heif` version. |
| `options` | module-like object | mutable global options | Global decode/encode defaults. |
| `libheif_version` | function | `libheif_version() -> str` | Returns linked/bundled libheif version. |
| `libheif_info` | function | `libheif_info() -> dict | str` | Returns libheif codec/plugin information; use for available encoder/decoder IDs. |
| `register_heif_opener` | function | `register_heif_opener(**kwargs) -> None` | Registers the Pillow HEIF opener/saver for `.heic`, `.heics`, `.heif`, `.heifs`, `.hif`. |
| `is_supported` | function | `is_supported(fp) -> bool` | Checks if an object contains a supported file type. |
| `open_heif` | function | `open_heif(fp, convert_hdr_to_8bit=True, bgr_mode=False, **kwargs) -> HeifFile` | Opens HEIF lazily. |
| `read_heif` | function | `read_heif(fp, convert_hdr_to_8bit=True, bgr_mode=False, **kwargs) -> HeifFile` | Opens and decodes all images. Prefer `open_heif()` for most workflows. |
| `from_pillow` | function | `from_pillow(pil_image: Image) -> HeifFile` | Creates `HeifFile` from a Pillow `Image`. |
| `from_bytes` | function | `from_bytes(mode: str, size: tuple[int, int], data, **kwargs) -> HeifFile` | Creates `HeifFile` from raw image bytes; supports `stride`. |
| `encode` | function | `encode(mode: str, size: tuple[int, int], data, fp, **kwargs) -> None` | Encodes raw bytes directly to a file/path/file-like object. |
| `get_file_mimetype` | function | `get_file_mimetype(fp) -> str` | Returns HEIF/AVIF MIME type or empty string. |
| `set_orientation` | function | `set_orientation(info: dict) -> int | None` | Resets EXIF orientation to `1`, removes XMP orientation tag, returns original orientation or `None`. |
| `load_libheif_plugin` | function | `load_libheif_plugin(plugin_path: str | Path) -> None` | Loads a specified libheif plugin path. Helper is mostly internal; prototype can change between versions. |
| `HeifImageFile` | class | Pillow image plugin class | Registered with Pillow by `register_heif_opener()`. |
| `HeifFile` | class | `HeifFile(fp=None, convert_hdr_to_8bit=True, bgr_mode=False, **kwargs)` | Container of one or more `HeifImage` objects. |
| `HeifImage` | class | `HeifImage(c_image)` | Image object inside `HeifFile`. |
| `HeifAuxImage` | class | `HeifAuxImage(c_image)` | Auxiliary image object; subclass of `BaseImage`. |
| `HeifDepthImage` | class | depth-image class | Depth image object. |
| `HeifColorPrimaries` | enum | `IntEnum` | NCLX color primary constants. |
| `HeifTransferCharacteristics` | enum | `IntEnum` | NCLX transfer characteristic constants. |
| `HeifMatrixCoefficients` | enum | `IntEnum` | NCLX matrix coefficient constants. |
| `HeifDepthRepresentationType` | enum | `IntEnum` | Depth representation constants. |

### Public functions

#### `is_supported(fp) -> bool`

| Parameter | Accepted value |
|---|---|
| `fp` | filename `str`, `pathlib.Path`, or binary file object implementing `read`, `seek`, and `tell` |

Returns `True` if the object can be opened by `pillow-heif`, else `False`.

#### `open_heif(fp, convert_hdr_to_8bit=True, bgr_mode=False, **kwargs) -> HeifFile`

| Parameter | Default | Meaning |
|---|---:|---|
| `fp` | required | Same accepted inputs as `is_supported()`. |
| `convert_hdr_to_8bit` | `True` | Convert 10/12-bit images to 8-bit during decode. If `False`, open in 16-bit mode. Does not affect monochrome or depth images. |
| `bgr_mode` | `False` | Open RGB(A) images as BGR(A). |
| `hdr_to_16bit` | `True` via `kwargs` | Convert 10/12-bit image data to 16-bit during decoding. Lower priority than `convert_hdr_to_8bit`. |

Raises: `ValueError`, `EOFError`, `SyntaxError`, `RuntimeError`, `OSError`.

#### `read_heif(fp, convert_hdr_to_8bit=True, bgr_mode=False, **kwargs) -> HeifFile`

Same parameters and raises as `open_heif()`. Difference: decodes all images immediately. Prefer `open_heif()` for lazy decoding.

#### `from_pillow(pil_image: Image) -> HeifFile`

Creates a new `HeifFile` from a Pillow `Image`.

#### `from_bytes(mode: str, size: tuple[int, int], data, **kwargs) -> HeifFile`

| Parameter | Meaning |
|---|---|
| `mode` | Image mode; see modes table. |
| `size` | `(width, height)`. |
| `data` | Raw image bytes. |
| `stride` | Optional row stride in `kwargs`. |

#### `encode(mode: str, size: tuple[int, int], data, fp, **kwargs) -> None`

| Parameter | Meaning |
|---|---|
| `mode` | One of supported raw modes. |
| `size` | `(width, height)`. |
| `data` | Raw image bytes. |
| `fp` | filename `str`, `pathlib.Path`, or object with `write`. |
| `**kwargs` | Save/encode parameters accepted by `HeifFile.save()` / Pillow `save()`. |

#### `get_file_mimetype(fp) -> str`

Accepted inputs: filename `str`, `pathlib.Path`, binary file object implementing `read`, `seek`, `tell`, or `bytes`.

Return values:

| Return value |
|---|
| `image/heic` |
| `image/heif` |
| `image/heic-sequence` |
| `image/heif-sequence` |
| `image/avif` |
| `image/avif-sequence` |
| `""` |

#### `set_orientation(info: dict) -> int | None`

Resets EXIF orientation to `1` if present, removes XMP orientation tag if present, and returns the original orientation. Does not add an orientation tag when absent. Pillow plugin mode calls it automatically on images; standalone mode requires manual call when needed.

### Pillow plugin surface

#### Registration

```python
from pillow_heif import register_heif_opener
register_heif_opener(**kwargs)
```

| Registration kwarg | Maps to option | Meaning |
|---|---|---|
| `decode_threads` | `options.DECODE_THREADS` | Maximum decode threads. |
| `thumbnails` | `options.THUMBNAILS` | Enable/disable thumbnail support. |
| `depth_images` | `options.DEPTH_IMAGES` | Enable/disable depth-image support. |
| `aux_images` | `options.AUX_IMAGES` | Enable/disable auxiliary-image support. |
| `quality` | `options.QUALITY` | Default encoding quality. |
| `save_to_12bit` | `options.SAVE_HDR_TO_12_BIT` | Save 16-bit images as 12-bit instead of 10-bit. |
| `allow_incorrect_headers` | `options.ALLOW_INCORRECT_HEADERS` | Permit decoded image size to differ from header size. |
| `save_nclx_profile` | `options.SAVE_NCLX_PROFILE` | Save or omit NCLX profiles. |
| `preferred_encoder` | `options.PREFERRED_ENCODER` | Encoder selection dict. |
| `preferred_decoder` | `options.PREFERRED_DECODER` | Decoder selection dict. |

Registered format/extensions:

| Format | Extensions | MIME |
|---|---|---|
| `HEIF` | `.heic`, `.heics`, `.heif`, `.heifs`, `.hif` | `image/heif` |

Pillow memory saves require `format="HEIF"`:

```python
from io import BytesIO
from PIL import Image
from pillow_heif import register_heif_opener

register_heif_opener()
buf = BytesIO()
Image.open("image.heic").save(buf, format="HEIF", quality=90)
```

#### `HeifImageFile` / Pillow image object

| Attribute / method | Meaning |
|---|---|
| `format` | `HEIF`. |
| `info` | Dict with HEIF metadata. |
| `info["exif"]` | EXIF bytes, if present. |
| `info["xmp"]` | XMP bytes, if present. |
| `info["metadata"]` | List of metadata blocks. |
| `info["primary"]` | Whether frame is primary image. |
| `info["bit_depth"]` | Component bit depth. |
| `info["thumbnails"]` | Thumbnail data/list when enabled. |
| `info["icc_profile"]` | ICC profile bytes, if present. |
| `info["icc_profile_type"]` | ICC profile type. |
| `info["nclx_profile"]` | NCLX color profile dict, if present. |
| `get_format_mimetype()` | Returns MIME string for current format. |
| `load()` | Loads image data. |
| `seek(frame)` | Seeks to frame index. |
| `tell()` | Returns current frame index. |
| `verify()` | Verifies file without decoding full image. |
| `n_frames` | Frame count. |
| `is_animated` | True for multi-frame/multi-image sequences. |

### `HeifFile` object

Constructor signature: `HeifFile(fp=None, convert_hdr_to_8bit=True, bgr_mode=False, **kwargs)`. Use factory functions (`open_heif`, `read_heif`, `from_pillow`, `from_bytes`) instead of direct construction.

| Attribute / method | Meaning |
|---|---|
| `size` | Size of the primary `HeifImage`; raises `IndexError` if empty. |
| `mode` | Mode of the primary `HeifImage`; raises `IndexError` if empty. |
| `has_alpha` | Alpha presence of the primary `HeifImage`; raises `IndexError` if empty. |
| `premultiplied_alpha` | Premultiplied alpha flag of the primary image; raises `IndexError` if empty. |
| `data` | Data of the primary `HeifImage`; raises `IndexError` if empty. |
| `stride` | Row stride of the primary `HeifImage`; raises `IndexError` if empty. |
| `info` | Info dict of the primary `HeifImage`; raises `IndexError` if empty. |
| `to_pillow() -> Image` | Converts primary image to Pillow `Image`. |
| `save(fp, **kwargs) -> None` | Saves HEIF data. |
| `add_frombytes(mode, size, data, **kwargs) -> HeifImage` | Adds an image from raw bytes. |
| `add_from_heif(image: HeifImage) -> HeifImage` | Adds/copies an image from another HEIF object. |
| `add_from_pillow(image: Image) -> HeifImage` | Adds image from Pillow `Image`. |
| `get_aux_image(aux_id)` | Returns auxiliary image by ID. |
| `__len__()` | Number of images. |
| `__iter__()` | Iterate `HeifImage` entries. |
| `__getitem__(index)` | Access image by index. |
| `__delitem__(index)` | Remove image by index. |

`HeifFile.save(fp, **kwargs)` / Pillow `Image.save(..., format="HEIF", **kwargs)` options:

| Save option | Meaning |
|---|---|
| `save_all` | Save all images. Pillow default `False`; `HeifFile` default `True`. |
| `append_images` | Extra images to append. |
| `quality` | `None`, `-1`, or `0..100`; `-1` requests lossless where encoder supports it. |
| `enc_params` | Encoder-specific parameters. |
| `exif` | EXIF bytes. |
| `xmp` | XMP bytes. |
| `primary_index` | Primary image index; `-1` means last image. Overrides `info["primary"]`. |
| `chroma` | Chroma/subsampling setting; `444` needed with lossless. |
| `subsampling` | Subsampling alias/parameter. |
| `save_nclx_profile` | Override global NCLX-save behavior. |
| `matrix_coefficients` | NCLX matrix coefficient; `0` for RGB color space in lossless examples. |
| `color_primaries` | NCLX color primaries override. |
| `transfer_characteristic` | NCLX transfer characteristic override. |
| `full_range_flag` | NCLX full-range flag override. |

Encoder limitations:

| Limitation |
|---|
| libheif does not support editing files in place; metadata-only changes still require rewriting the file. |
| HEIF format does not store the original encoding quality. |
| 16-bit images created from `add_from_pillow()`, `add_frombytes()`, or Pillow `I` mode save to 10-bit by default; set `SAVE_HDR_TO_12_BIT` / `save_to_12bit` for 12-bit. |

### `HeifImage` object

Class signature: `HeifImage(c_image)`. Represents one image inside a `HeifFile`.

| Attribute / method | Meaning |
|---|---|
| `size` | `(width, height)`. |
| `mode` | Pillow-style mode. |
| `data` | Raw decoded image bytes; loads image as needed. |
| `stride` | Row stride in bytes. |
| `info` | Dict containing metadata and HEIF-specific attributes. |
| `info["exif"]` | EXIF bytes, if present. |
| `info["xmp"]` | XMP bytes, if present. |
| `info["metadata"]` | Metadata blocks. |
| `info["primary"]` | Primary-image flag. |
| `info["bit_depth"]` | Component bit depth. |
| `info["thumbnails"]` | Thumbnail data/list when enabled. |
| `info["icc_profile"]` | ICC profile bytes, if present. |
| `info["icc_profile_type"]` | ICC profile type, if present. |
| `info["nclx_profile"]` | NCLX profile dict, if present. |
| `info["depth_images"]` | Depth-image list when enabled. |
| `has_alpha` | Alpha channel flag. |
| `premultiplied_alpha` | Premultiplied alpha flag. |
| `to_pillow() -> Image` | Convert to Pillow `Image`; resets orientation automatically. |
| `get_aux_image(aux_id)` | Return auxiliary image by ID. |
| `load()` | Decode/load image data. |

### `HeifDepthImage` object

Depth image object with BaseImage-like data access.

| Attribute / method | Meaning |
|---|---|
| `size` | `(width, height)`. |
| `mode` | Depth image mode. |
| `data` | Raw depth bytes. |
| `stride` | Row stride. |
| `info` | Depth info dict. |
| `to_pillow() -> Image` | Convert depth image to Pillow `Image`. |
| `load()` | Decode/load depth data. |


### `HeifAuxImage` object

Auxiliary image object associated with a `HeifImage`; subclass of `BaseImage`.

| Attribute / method | Meaning |
|---|---|
| `size` | `(width, height)`. |
| `mode` | Auxiliary image mode. |
| `data` | Raw auxiliary image bytes. |
| `stride` | Row stride. |
| `to_pillow() -> Image` | Convert auxiliary image to Pillow `Image`. |
| `load()` | Decode/load auxiliary data. |

### Supported raw modes

Used by `from_bytes()` and `encode()`.

| Mode pattern | Meaning |
|---|---|
| `RGB`, `RGBa`, `RGBA` | 8-bit RGB/RGB-premultiplied-alpha/RGBA. |
| `BGR`, `BGRa`, `BGRA` | 8-bit BGR/BGR-premultiplied-alpha/BGRA. |
| `L`, `La`, `LA` | 8-bit grayscale/grayscale-premultiplied-alpha/grayscale-alpha. |
| `YCbCr` | 8-bit YCbCr. |
| `RGB;10`, `RGBa;10`, `RGBA;10` | 10-bit RGB/RGB-premultiplied-alpha/RGBA. |
| `BGR;10`, `BGRa;10`, `BGRA;10` | 10-bit BGR/BGR-premultiplied-alpha/BGRA. |
| `L;10`, `I;10`, `I;10L`, `La;10`, `LA;10` | 10-bit grayscale variants. |
| `RGB;12`, `RGBa;12`, `RGBA;12` | 12-bit RGB/RGB-premultiplied-alpha/RGBA. |
| `BGR;12`, `BGRa;12`, `BGRA;12` | 12-bit BGR/BGR-premultiplied-alpha/BGRA. |
| `L;12`, `I;12`, `I;12L`, `La;12`, `LA;12` | 12-bit grayscale variants. |
| `RGB;16`, `RGBa;16`, `RGBA;16` | 16-bit RGB/RGB-premultiplied-alpha/RGBA input. |
| `BGR;16`, `BGRa;16`, `BGRA;16` | 16-bit BGR/BGR-premultiplied-alpha/BGRA input. |
| `L;16`, `I;16`, `I;16L`, `La;16`, `LA;16` | 16-bit grayscale variants. |

### Global options

Mutate as `pillow_heif.options.<NAME> = value`, or pass corresponding kwargs to `register_heif_opener()` where supported.

| Option | Default | Meaning |
|---|---:|---|
| `DECODE_THREADS` | `4` | Maximum number of decode threads when possible. |
| `THUMBNAILS` | `True` | Enable thumbnail support. |
| `DEPTH_IMAGES` | `True` | Enable depth-image support. |
| `AUX_IMAGES` | `True` | Enable auxiliary-image support. |
| `QUALITY` | `None` | Default encoding quality. `None`, `-1`, or `0..100`; `-1` for lossless where supported. |
| `SAVE_HDR_TO_12_BIT` | `False` | Save 16-bit images to 12-bit instead of 10-bit. |
| `ALLOW_INCORRECT_HEADERS` | `False` | Allow header size to differ from decoded size; `Image.size` can change after loading. |
| `SAVE_NCLX_PROFILE` | `True` | Save NCLX profile by default. |
| `PREFERRED_ENCODER` | `{'AVIF': '', 'HEIF': ''}` | Preferred encoder IDs by format; discover IDs with `libheif_info()`. |
| `PREFERRED_DECODER` | `{'AVIF': '', 'HEIF': ''}` | Preferred decoder IDs by format; discover IDs with `libheif_info()`. |
| `DISABLE_SECURITY_LIMITS` | `False` | Completely disable libheif security limits. |

### Constants

#### `HeifColorPrimaries`

| Name | Value |
|---|---:|
| `ITU_R_BT_709_5` | `1` |
| `UNSPECIFIED` | `2` |
| `ITU_R_BT_470_6_SYSTEM_M` | `4` |
| `ITU_R_BT_470_6_SYSTEM_B_G` | `5` |
| `ITU_R_BT_601_6` | `6` |
| `SMPTE_240M` | `7` |
| `GENERIC_FILM` | `8` |
| `ITU_R_BT_2020_2_AND_2100_0` | `9` |
| `SMPTE_ST_428_1` | `10` |
| `SMPTE_RP_431_2` | `11` |
| `SMPTE_EG_432_1` | `12` |
| `EBU_TECH_3213_E` | `22` |

#### `HeifTransferCharacteristics`

| Name | Value |
|---|---:|
| `ITU_R_BT_709_5` | `1` |
| `UNSPECIFIED` | `2` |
| `ITU_R_BT_470_6_SYSTEM_M` | `4` |
| `ITU_R_BT_470_6_SYSTEM_B_G` | `5` |
| `ITU_R_BT_601_6` | `6` |
| `SMPTE_240M` | `7` |
| `LINEAR` | `8` |
| `LOGARITHMIC_100` | `9` |
| `LOGARITHMIC_100_SQRT10` | `10` |
| `IEC_61966_2_4` | `11` |
| `ITU_R_BT_1361` | `12` |
| `IEC_61966_2_1` | `13` |
| `ITU_R_BT_2020_2_10BIT` | `14` |
| `ITU_R_BT_2020_2_12BIT` | `15` |
| `ITU_R_BT_2100_0_PQ` | `16` |
| `SMPTE_ST_428_1` | `17` |
| `ITU_R_BT_2100_0_HLG` | `18` |

#### `HeifMatrixCoefficients`

| Name | Value |
|---|---:|
| `RGB_GBR` | `0` |
| `ITU_R_BT_709_5` | `1` |
| `UNSPECIFIED` | `2` |
| `US_FCC_T47` | `4` |
| `ITU_R_BT_470_6_SYSTEM_B_G` | `5` |
| `ITU_R_BT_601_6` | `6` |
| `SMPTE_240M` | `7` |
| `YCGCO` | `8` |
| `ITU_R_BT_2020_2_NON_CONSTANT_LUMINANCE` | `9` |
| `ITU_R_BT_2020_2_CONSTANT_LUMINANCE` | `10` |
| `SMPTE_ST_2085` | `11` |
| `CHROMATICITY_DERIVED_NON_CONSTANT_LUMINANCE` | `12` |
| `CHROMATICITY_DERIVED_CONSTANT_LUMINANCE` | `13` |
| `ICTCP` | `14` |

#### `HeifDepthRepresentationType`

| Name | Value |
|---|---:|
| `UNIFORM_INVERSE_Z` | `0` |
| `UNIFORM_DISPARITY` | `1` |
| `UNIFORM_Z` | `2` |
| `NON_UNIFORM_DISPARITY` | `3` |

### Orientation behavior

| Path | Orientation handling |
|---|---|
| Pillow plugin open (`Image.open`) | Calls `set_orientation()` automatically. |
| `from_pillow()` | Resets orientation automatically. |
| `HeifFile.add_from_pillow()` | Resets orientation automatically. |
| `HeifImage.to_pillow()` | Resets orientation automatically. |
| `open_heif()` | Does not reset orientation automatically. |
| `HeifFile.add_from_heif()` | Does not reset orientation automatically. |

## Setup & auth

Install from PyPI:

```bash
python3 -m pip install --upgrade pip
python3 -m pip install --upgrade pillow-heif
```

Python requirement: Python `>=3.10` for current releases.

Wheel coverage:

| Runtime | macOS Intel | macOS Silicon | Windows | musllinux | manylinux |
|---|---|---|---|---|---|
| CPython 3.10 | yes | yes | yes | yes | yes |
| CPython 3.11 | yes | yes | yes | yes | yes |
| CPython 3.12 | yes | yes | yes | yes | yes |
| CPython 3.13 | yes | yes | yes | yes | yes |
| CPython 3.14 | yes | yes | yes | yes | yes |
| CPython 3.14t | yes | yes | yes | yes | yes |
| PyPy 3.11 v7.3 | yes | yes | yes | no | yes |

Source build requirements:

| Dependency | Required version / condition |
|---|---|
| `libheif` | `>=1.17.0`; recommended `>=1.17.3`. |
| `x265` | Must support 10/12-bit encoding to save those bit depths. |
| `aom` | `>=3.3.0`. |
| `libde265` | `>=1.0.8`. |

Ubuntu source build baseline:

```bash
sudo add-apt-repository ppa:strukturag/libheif
sudo apt update
sudo apt -y install libheif-dev
python3 -m pip install --upgrade pillow-heif --no-binary :all:
```

Alpine source build baseline:

```bash
sudo apk add --no-cache libheif-dev
python3 -m pip install --upgrade pillow-heif --no-binary :all:
```

macOS source builds use Homebrew/MacPorts libheif dependencies. Windows source builds are fragile because libheif and codec DLLs must be installed/discoverable; prefer wheels unless a custom libheif build is required.

State/auth:

| Item | Location / requirement |
|---|---|
| Credentials | None. |
| Config files | None. |
| Runtime state | None beyond Python package files and dynamic library/plugin loading. |
| Native dependency state | Wheels bundle usable libheif components; source builds depend on system libheif and codec libraries. |

## Common workflows

Register the Pillow plugin and save a rotated HEIC:

```python
from PIL import Image
from pillow_heif import register_heif_opener

register_heif_opener()
im = Image.open("image.heic")
im = im.rotate(13)
im.save("rotated_image.heic", quality=90)
```

Output: Pillow can open HEIC and save `rotated_image.heic` as HEIF.

Create 10-bit HEIF from a 16-bit OpenCV BGRA PNG:

```python
import cv2
import pillow_heif

cv_img = cv2.imread("16bit_with_alpha.png", cv2.IMREAD_UNCHANGED)
heif_file = pillow_heif.from_bytes(
    mode="BGRA;16",
    size=(cv_img.shape[1], cv_img.shape[0]),
    data=bytes(cv_img),
)
heif_file.save("RGBA_10bit.heic", quality=-1)
```

Output: `RGBA_10bit.heic` saved from raw 16-bit BGRA bytes.

Decode 8/10/12-bit HEIF to OpenCV-friendly array:

```python
import cv2
import numpy as np
import pillow_heif

heif_file = pillow_heif.open_heif("image.heic", convert_hdr_to_8bit=False, bgr_mode=True)
np_array = np.asarray(heif_file)
cv2.imwrite("image.png", np_array)
```

Output: `image.png`; HDR input remains 16-bit when applicable.

Access decoded data and metadata without Pillow plugin mode:

```python
import pillow_heif

if pillow_heif.is_supported("image.heic"):
    heif_file = pillow_heif.open_heif("image.heic", convert_hdr_to_8bit=False)
    image = heif_file[0]
    print(image.mode, image.size, image.info.get("bit_depth"), image.info.keys())
    raw = image.data
```

Output: standalone HEIF decode with lazy data access.

Work with a multi-image HEIF container:

```python
from PIL import Image
import pillow_heif

heif_file = pillow_heif.open_heif("sequence.heif")
heif_file.add_from_pillow(Image.open("extra.jpg"))
del heif_file[0]
heif_file.save("updated.heif", save_all=True, primary_index=-1)
```

Output: `updated.heif` rewritten with modified image list and last image primary.

## Error handling

| Symptom | Likely cause | Fix |
|---|---|---|
| `ValueError` | Invalid input data passed to `open_heif()` / `read_heif()` / `HeifFile`. | Preflight with `pillow_heif.is_supported(fp)` or `get_file_mimetype(fp)`; verify the path, bytes, and file mode. |
| `EOFError` | Corrupted or truncated image data. | Re-copy the source file, verify byte length, and test with `heif-info` or another libheif-based tool. |
| `SyntaxError` | Unsupported HEIF feature or codec path. | Upgrade `pillow-heif`; for source builds, rebuild libheif with required decoder/encoder plugins. |
| `RuntimeError` | Other libheif failure. | Capture the exact message, inspect `pillow_heif.libheif_info()` / `libheif_version()`, and select `PREFERRED_DECODER` or `PREFERRED_ENCODER` when multiple codecs exist. |
| `OSError` | Out of memory during decode. | Use lazy `open_heif()`, disable `THUMBNAILS` / `DEPTH_IMAGES` if not needed, reduce decode threads, and avoid decoding all frames at once. |
| `AttributeError: module 'pillow_heif' has no attribute 'register_avif_opener'` | Code expects the pre-1.0 AVIF opener API; current `pillow-heif` focuses on HEIF registration. | Use `register_heif_opener()` for HEIF files; for legacy AVIF workflows pin `pillow-heif<1.0` only when required or use a dedicated AVIF plugin/library. |
| `Image.size` changes after loading | File header dimensions differ from decoded image dimensions and `ALLOW_INCORRECT_HEADERS` is enabled. | Leave `ALLOW_INCORRECT_HEADERS=False` for strict pipelines; enable only for known malformed files. |
| `HEIF` save unavailable after plugin registration | Custom source build lacks a HEIF encoder; plugin registers open but not save methods. | Check `pillow_heif.libheif_info()` and rebuild/install libheif with a HEIF encoder, or use a wheel with encoder support. |
| Metadata-only edits still rewrite full file | libheif does not support editing files in place. | Treat every save as a full rewrite; write to a new path or temporary file and replace atomically. |

## Traps

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command when something bites._

## Lessons

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command for behaviors learned that aren't in upstream docs._
