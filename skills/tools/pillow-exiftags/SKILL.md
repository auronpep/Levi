---
name: tool-pillow-exiftags
description: Load when working with Pillow.ExifTags, PIL.ExifTags, EXIF tag names, GPS IFD metadata, orientation tags, or LightSource enums. Covers API surface, setup, metadata workflows, and error handling.
triggers:
  bash: []
---

# Pillow.ExifTags

## What it is

**Assumption:** identifier `Pillow.ExifTags` interpreted as Pillow's importable `PIL.ExifTags` module in the `python-pillow/Pillow` project. `PIL.ExifTags` is a pure Python library module that exposes `enum.IntEnum` constants and legacy dictionaries for decoding EXIF, GPS, interoperability, IFD pointer, and light-source tag IDs into stable names. Reach for it when reading or writing image metadata through `PIL.Image.getexif()`, labeling raw EXIF tag integers, resolving orientation tags, or extracting GPS IFD fields; common alternatives are ExifTool, piexif, and exifread for heavier metadata work.

## Capability surface

### Import forms

```python
from PIL import ExifTags
from PIL.ExifTags import Base, GPS, Interop, IFD, LightSource, TAGS, GPSTAGS
```

`PIL.ExifTags` has no CLI entry point. `triggers.bash` is intentionally empty; load this skill explicitly when Python code imports or references `PIL.ExifTags`, `Pillow.ExifTags`, EXIF tag IDs, GPS IFDs, or Pillow metadata constants.

### Public top-level objects

| Object | Type | Purpose |
|---|---|---|
| `Base` | `enum.IntEnum` | EXIF/TIFF base tag IDs and clear-text member names. |
| `GPS` | `enum.IntEnum` | GPS IFD tag IDs and clear-text member names. |
| `Interop` | `enum.IntEnum` | EXIF interoperability IFD tag IDs. |
| `IFD` | `enum.IntEnum` | IFD pointer constants for `Exif.get_ifd()`. |
| `LightSource` | `enum.IntEnum` | Values used by EXIF tag `Base.LightSource` (`0x9208`). |
| `TAGS` | `dict[int, str]` | Legacy mapping from EXIF tag integer to tag name. |
| `GPSTAGS` | `dict[int, str]` | Legacy mapping from GPS tag integer to tag name. |

`IntEnum` is imported in the module and visible as `PIL.ExifTags.IntEnum`, but it is an implementation dependency rather than the API target.

### `class PIL.ExifTags.Base(IntEnum)`

Official source note: `Base` is marked “possibly incomplete”. Values:

```python
class Base(IntEnum):
    InteropIndex = 0x0001
    ProcessingSoftware = 0x000B
    NewSubfileType = 0x00FE
    SubfileType = 0x00FF
    ImageWidth = 0x0100
    ImageLength = 0x0101
    BitsPerSample = 0x0102
    Compression = 0x0103
    PhotometricInterpretation = 0x0106
    Thresholding = 0x0107
    CellWidth = 0x0108
    CellLength = 0x0109
    FillOrder = 0x010A
    DocumentName = 0x010D
    ImageDescription = 0x010E
    Make = 0x010F
    Model = 0x0110
    StripOffsets = 0x0111
    Orientation = 0x0112
    SamplesPerPixel = 0x0115
    RowsPerStrip = 0x0116
    StripByteCounts = 0x0117
    MinSampleValue = 0x0118
    MaxSampleValue = 0x0119
    XResolution = 0x011A
    YResolution = 0x011B
    PlanarConfiguration = 0x011C
    PageName = 0x011D
    FreeOffsets = 0x0120
    FreeByteCounts = 0x0121
    GrayResponseUnit = 0x0122
    GrayResponseCurve = 0x0123
    T4Options = 0x0124
    T6Options = 0x0125
    ResolutionUnit = 0x0128
    PageNumber = 0x0129
    TransferFunction = 0x012D
    Software = 0x0131
    DateTime = 0x0132
    Artist = 0x013B
    HostComputer = 0x013C
    Predictor = 0x013D
    WhitePoint = 0x013E
    PrimaryChromaticities = 0x013F
    ColorMap = 0x0140
    HalftoneHints = 0x0141
    TileWidth = 0x0142
    TileLength = 0x0143
    TileOffsets = 0x0144
    TileByteCounts = 0x0145
    SubIFDs = 0x014A
    InkSet = 0x014C
    InkNames = 0x014D
    NumberOfInks = 0x014E
    DotRange = 0x0150
    TargetPrinter = 0x0151
    ExtraSamples = 0x0152
    SampleFormat = 0x0153
    SMinSampleValue = 0x0154
    SMaxSampleValue = 0x0155
    TransferRange = 0x0156
    ClipPath = 0x0157
    XClipPathUnits = 0x0158
    YClipPathUnits = 0x0159
    Indexed = 0x015A
    JPEGTables = 0x015B
    OPIProxy = 0x015F
    JPEGProc = 0x0200
    JpegIFOffset = 0x0201
    JpegIFByteCount = 0x0202
    JpegRestartInterval = 0x0203
    JpegLosslessPredictors = 0x0205
    JpegPointTransforms = 0x0206
    JpegQTables = 0x0207
    JpegDCTables = 0x0208
    JpegACTables = 0x0209
    YCbCrCoefficients = 0x0211
    YCbCrSubSampling = 0x0212
    YCbCrPositioning = 0x0213
    ReferenceBlackWhite = 0x0214
    XMLPacket = 0x02BC
    RelatedImageFileFormat = 0x1000
    RelatedImageWidth = 0x1001
    RelatedImageLength = 0x1002
    Rating = 0x4746
    RatingPercent = 0x4749
    ImageID = 0x800D
    CFARepeatPatternDim = 0x828D
    BatteryLevel = 0x828F
    Copyright = 0x8298
    ExposureTime = 0x829A
    FNumber = 0x829D
    IPTCNAA = 0x83BB
    ImageResources = 0x8649
    ExifOffset = 0x8769
    InterColorProfile = 0x8773
    ExposureProgram = 0x8822
    SpectralSensitivity = 0x8824
    GPSInfo = 0x8825
    ISOSpeedRatings = 0x8827
    OECF = 0x8828
    Interlace = 0x8829
    TimeZoneOffset = 0x882A
    SelfTimerMode = 0x882B
    SensitivityType = 0x8830
    StandardOutputSensitivity = 0x8831
    RecommendedExposureIndex = 0x8832
    ISOSpeed = 0x8833
    ISOSpeedLatitudeyyy = 0x8834
    ISOSpeedLatitudezzz = 0x8835
    ExifVersion = 0x9000
    DateTimeOriginal = 0x9003
    DateTimeDigitized = 0x9004
    OffsetTime = 0x9010
    OffsetTimeOriginal = 0x9011
    OffsetTimeDigitized = 0x9012
    ComponentsConfiguration = 0x9101
    CompressedBitsPerPixel = 0x9102
    ShutterSpeedValue = 0x9201
    ApertureValue = 0x9202
    BrightnessValue = 0x9203
    ExposureBiasValue = 0x9204
    MaxApertureValue = 0x9205
    SubjectDistance = 0x9206
    MeteringMode = 0x9207
    LightSource = 0x9208
    Flash = 0x9209
    FocalLength = 0x920A
    Noise = 0x920D
    ImageNumber = 0x9211
    SecurityClassification = 0x9212
    ImageHistory = 0x9213
    TIFFEPStandardID = 0x9216
    MakerNote = 0x927C
    UserComment = 0x9286
    SubsecTime = 0x9290
    SubsecTimeOriginal = 0x9291
    SubsecTimeDigitized = 0x9292
    AmbientTemperature = 0x9400
    Humidity = 0x9401
    Pressure = 0x9402
    WaterDepth = 0x9403
    Acceleration = 0x9404
    CameraElevationAngle = 0x9405
    XPTitle = 0x9C9B
    XPComment = 0x9C9C
    XPAuthor = 0x9C9D
    XPKeywords = 0x9C9E
    XPSubject = 0x9C9F
    FlashPixVersion = 0xA000
    ColorSpace = 0xA001
    ExifImageWidth = 0xA002
    ExifImageHeight = 0xA003
    RelatedSoundFile = 0xA004
    ExifInteroperabilityOffset = 0xA005
    FlashEnergy = 0xA20B
    SpatialFrequencyResponse = 0xA20C
    FocalPlaneXResolution = 0xA20E
    FocalPlaneYResolution = 0xA20F
    FocalPlaneResolutionUnit = 0xA210
    SubjectLocation = 0xA214
    ExposureIndex = 0xA215
    SensingMethod = 0xA217
    FileSource = 0xA300
    SceneType = 0xA301
    CFAPattern = 0xA302
    CustomRendered = 0xA401
    ExposureMode = 0xA402
    WhiteBalance = 0xA403
    DigitalZoomRatio = 0xA404
    FocalLengthIn35mmFilm = 0xA405
    SceneCaptureType = 0xA406
    GainControl = 0xA407
    Contrast = 0xA408
    Saturation = 0xA409
    Sharpness = 0xA40A
    DeviceSettingDescription = 0xA40B
    SubjectDistanceRange = 0xA40C
    ImageUniqueID = 0xA420
    CameraOwnerName = 0xA430
    BodySerialNumber = 0xA431
    LensSpecification = 0xA432
    LensMake = 0xA433
    LensModel = 0xA434
    LensSerialNumber = 0xA435
    CompositeImage = 0xA460
    CompositeImageCount = 0xA461
    CompositeImageExposureTimes = 0xA462
    Gamma = 0xA500
    PrintImageMatching = 0xC4A5
    DNGVersion = 0xC612
    DNGBackwardVersion = 0xC613
    UniqueCameraModel = 0xC614
    LocalizedCameraModel = 0xC615
    CFAPlaneColor = 0xC616
    CFALayout = 0xC617
    LinearizationTable = 0xC618
    BlackLevelRepeatDim = 0xC619
    BlackLevel = 0xC61A
    BlackLevelDeltaH = 0xC61B
    BlackLevelDeltaV = 0xC61C
    WhiteLevel = 0xC61D
    DefaultScale = 0xC61E
    DefaultCropOrigin = 0xC61F
    DefaultCropSize = 0xC620
    ColorMatrix1 = 0xC621
    ColorMatrix2 = 0xC622
    CameraCalibration1 = 0xC623
    CameraCalibration2 = 0xC624
    ReductionMatrix1 = 0xC625
    ReductionMatrix2 = 0xC626
    AnalogBalance = 0xC627
    AsShotNeutral = 0xC628
    AsShotWhiteXY = 0xC629
    BaselineExposure = 0xC62A
    BaselineNoise = 0xC62B
    BaselineSharpness = 0xC62C
    BayerGreenSplit = 0xC62D
    LinearResponseLimit = 0xC62E
    CameraSerialNumber = 0xC62F
    LensInfo = 0xC630
    ChromaBlurRadius = 0xC631
    AntiAliasStrength = 0xC632
    ShadowScale = 0xC633
    DNGPrivateData = 0xC634
    MakerNoteSafety = 0xC635
    CalibrationIlluminant1 = 0xC65A
    CalibrationIlluminant2 = 0xC65B
    BestQualityScale = 0xC65C
    RawDataUniqueID = 0xC65D
    OriginalRawFileName = 0xC68B
    OriginalRawFileData = 0xC68C
    ActiveArea = 0xC68D
    MaskedAreas = 0xC68E
    AsShotICCProfile = 0xC68F
    AsShotPreProfileMatrix = 0xC690
    CurrentICCProfile = 0xC691
    CurrentPreProfileMatrix = 0xC692
    ColorimetricReference = 0xC6BF
    CameraCalibrationSignature = 0xC6F3
    ProfileCalibrationSignature = 0xC6F4
    AsShotProfileName = 0xC6F6
    NoiseReductionApplied = 0xC6F7
    ProfileName = 0xC6F8
    ProfileHueSatMapDims = 0xC6F9
    ProfileHueSatMapData1 = 0xC6FA
    ProfileHueSatMapData2 = 0xC6FB
    ProfileToneCurve = 0xC6FC
    ProfileEmbedPolicy = 0xC6FD
    ProfileCopyright = 0xC6FE
    ForwardMatrix1 = 0xC714
    ForwardMatrix2 = 0xC715
    PreviewApplicationName = 0xC716
    PreviewApplicationVersion = 0xC717
    PreviewSettingsName = 0xC718
    PreviewSettingsDigest = 0xC719
    PreviewColorSpace = 0xC71A
    PreviewDateTime = 0xC71B
    RawImageDigest = 0xC71C
    OriginalRawFileDigest = 0xC71D
    SubTileBlockSize = 0xC71E
    RowInterleaveFactor = 0xC71F
    ProfileLookTableDims = 0xC725
    ProfileLookTableData = 0xC726
    OpcodeList1 = 0xC740
    OpcodeList2 = 0xC741
    OpcodeList3 = 0xC74E
    NoiseProfile = 0xC761
    FrameRate = 0xC764
```

Lookup examples:

```python
Base.ImageDescription.value  # 270
Base(270).name               # 'ImageDescription'
Base.Orientation.value       # 274 / 0x0112
```

### `PIL.ExifTags.TAGS: dict[int, str]`

`TAGS` maps EXIF tag integers to descriptive strings. Construction:

```python
TAGS = {
    **{i.value: i.name for i in Base},
    0x920C: "SpatialFrequencyResponse",
    0x9214: "SubjectLocation",
    0x9215: "ExposureIndex",
    0x828E: "CFAPattern",
    0x920B: "FlashEnergy",
    0x9216: "TIFF/EPStandardID",
}
```

Read with fallback, not direct indexing, when unknown vendor tags are possible:

```python
name = TAGS.get(tag_id, tag_id)
```

### `class PIL.ExifTags.GPS(IntEnum)`

Values:

```python
class GPS(IntEnum):
    GPSVersionID = 0x00
    GPSLatitudeRef = 0x01
    GPSLatitude = 0x02
    GPSLongitudeRef = 0x03
    GPSLongitude = 0x04
    GPSAltitudeRef = 0x05
    GPSAltitude = 0x06
    GPSTimeStamp = 0x07
    GPSSatellites = 0x08
    GPSStatus = 0x09
    GPSMeasureMode = 0x0A
    GPSDOP = 0x0B
    GPSSpeedRef = 0x0C
    GPSSpeed = 0x0D
    GPSTrackRef = 0x0E
    GPSTrack = 0x0F
    GPSImgDirectionRef = 0x10
    GPSImgDirection = 0x11
    GPSMapDatum = 0x12
    GPSDestLatitudeRef = 0x13
    GPSDestLatitude = 0x14
    GPSDestLongitudeRef = 0x15
    GPSDestLongitude = 0x16
    GPSDestBearingRef = 0x17
    GPSDestBearing = 0x18
    GPSDestDistanceRef = 0x19
    GPSDestDistance = 0x1A
    GPSProcessingMethod = 0x1B
    GPSAreaInformation = 0x1C
    GPSDateStamp = 0x1D
    GPSDifferential = 0x1E
    GPSHPositioningError = 0x1F
```

Lookup examples:

```python
GPS.GPSDestLatitude.value  # 20 / 0x14
GPS(20).name              # 'GPSDestLatitude'
```

### `PIL.ExifTags.GPSTAGS: dict[int, str]`

`GPSTAGS` maps GPS tag integers to descriptive strings. Construction:

```python
GPSTAGS = {i.value: i.name for i in GPS}
```

Read with fallback:

```python
name = GPSTAGS.get(tag_id, tag_id)
```

### `class PIL.ExifTags.Interop(IntEnum)`

Values:

```python
class Interop(IntEnum):
    InteropIndex = 0x0001
    InteropVersion = 0x0002
    RelatedImageFileFormat = 0x1000
    RelatedImageWidth = 0x1001
    RelatedImageHeight = 0x1002
```

Lookup examples:

```python
Interop.RelatedImageFileFormat.value  # 4096 / 0x1000
Interop(4096).name                    # 'RelatedImageFileFormat'
```

### `class PIL.ExifTags.IFD(IntEnum)`

Values for `PIL.Image.Exif.get_ifd(tag)`:

```python
class IFD(IntEnum):
    Exif = 0x8769
    GPSInfo = 0x8825
    MakerNote = 0x927C
    Makernote = 0x927C  # Deprecated
    Interop = 0xA005
    IFD1 = -1
```

`Makernote` is retained as a deprecated alias for `MakerNote`. Prefer `IFD.MakerNote`.

### `class PIL.ExifTags.LightSource(IntEnum)`

Values used by `Base.LightSource` (`0x9208`):

```python
class LightSource(IntEnum):
    Unknown = 0x00
    Daylight = 0x01
    Fluorescent = 0x02
    Tungsten = 0x03
    Flash = 0x04
    Fine = 0x09
    Cloudy = 0x0A
    Shade = 0x0B
    DaylightFluorescent = 0x0C
    DayWhiteFluorescent = 0x0D
    CoolWhiteFluorescent = 0x0E
    WhiteFluorescent = 0x0F
    StandardLightA = 0x11
    StandardLightB = 0x12
    StandardLightC = 0x13
    D55 = 0x14
    D65 = 0x15
    D75 = 0x16
    D50 = 0x17
    ISO = 0x18
    Other = 0xFF
```

Safe label lookup:

```python
label = LightSource(value).name if value in LightSource._value2member_map_ else value
```

### Adjacent Pillow EXIF APIs used with `ExifTags`

`ExifTags` names constants; EXIF data access lives on `PIL.Image.Image` and `PIL.Image.Exif`.

```python
Image.getexif() -> PIL.Image.Exif
```

`PIL.Image.Exif` is a mutable mapping for EXIF image data.

| Signature / member | Purpose |
|---|---|
| `class PIL.Image.Exif(MutableMapping)` | Read/write EXIF mapping returned by `Image.getexif()`. |
| `bigtiff = False` | BigTIFF mode flag. |
| `endian: str | None = None` | EXIF byte order state. |
| `get_ifd(tag: int) -> dict[int, Any]` | Return nested IFD dictionary such as GPS, Exif, MakerNote, Interop, or IFD1. |
| `hide_offsets() -> None` | Hide offset fields before serialization. |
| `load(data: bytes) -> None` | Load EXIF bytes. |
| `load_from_fp(fp: IO[bytes], offset: int | None = None) -> None` | Load EXIF from a file-like object. |
| `tobytes(offset: int = 8) -> bytes` | Serialize EXIF data for `Image.save(..., exif=...)`. |

Nested IFD access constants:

```python
exif.get_ifd(ExifTags.IFD.Exif)
exif.get_ifd(ExifTags.IFD.GPSInfo)
exif.get_ifd(ExifTags.IFD.MakerNote)
exif.get_ifd(ExifTags.IFD.Interop)
exif.get_ifd(ExifTags.IFD.IFD1)
```

## Setup & auth

Install package:

```bash
python3 -m pip install --upgrade pip
python3 -m pip install --upgrade Pillow
```

Optional Pillow extras adjacent to metadata work:

```bash
python3 -m pip install --upgrade defusedxml olefile
```

Package/import names:

| Layer | Name |
|---|---|
| PyPI package | `Pillow` |
| Import namespace | `PIL` |
| Module | `PIL.ExifTags` |
| Import target | `from PIL import ExifTags` |

Version notes:

| Pillow version | Relevant EXIF API note |
|---|---|
| `8.2.0` | EXIF and GPS IFDs kept separate; use `im.getexif().get_ifd(0x8769)` and `im.getexif().get_ifd(0x8825)`. |
| `9.3.0` | `ExifTags.Base` and `ExifTags.GPS` `IntEnum` classes added. |
| `9.4.0` | `ExifTags.Interop`, `ExifTags.IFD`, and `ExifTags.LightSource` additions landed in the 9.4.0 change set. |
| Current stable docs basis | Pillow `12.2.0` documentation/source. |

Auth: none.

State: no config file, credential store, or persistent session. EXIF state exists in image bytes, `Image.info`, and `PIL.Image.Exif` instances returned by `Image.getexif()`. Serialized EXIF bytes are passed to writers through `Image.save(..., exif=exif.tobytes())`.

Platform notes: `PIL.ExifTags` itself is platform-neutral. Pillow wheels are published for common Linux, macOS, and Windows targets. Linux distro packages may expose Pillow as `python3-pil` or similar; prefer PyPI wheels in isolated Python environments when matching upstream docs.

## Common workflows

Decode top-level EXIF tag IDs to names:

```python
from PIL import Image
from PIL.ExifTags import TAGS

with Image.open("photo.jpg") as im:
    exif = im.getexif()
    labeled = {TAGS.get(tag_id, tag_id): value for tag_id, value in exif.items()}

print(labeled)
```

Output: dictionary keyed by descriptive tag names where Pillow knows the tag, otherwise raw integer IDs.

Read the orientation tag and normalize display orientation:

```python
from PIL import Image, ImageOps
from PIL.ExifTags import Base

with Image.open("photo.jpg") as im:
    orientation = im.getexif().get(Base.Orientation)
    normalized = ImageOps.exif_transpose(im)

print(orientation)
normalized.save("photo-normalized.jpg")
```

Output/side effect: prints original EXIF orientation value; saves a copy with orientation applied and orientation metadata removed by `ImageOps.exif_transpose()`.

Extract GPS IFD and decode GPS field names:

```python
from PIL import Image, ExifTags
from PIL.ExifTags import GPSTAGS

with Image.open("photo.jpg") as im:
    exif = im.getexif()
    gps_ifd = exif.get_ifd(ExifTags.IFD.GPSInfo)
    gps = {GPSTAGS.get(tag_id, tag_id): value for tag_id, value in gps_ifd.items()}

print(gps)
```

Output: GPS dictionary such as `GPSLatitude`, `GPSLongitude`, `GPSAltitude`, and `GPSDateStamp` when present.

Write or update a simple EXIF tag and save it:

```python
from PIL import Image
from PIL.ExifTags import Base

with Image.open("photo.jpg") as im:
    exif = im.getexif()
    exif[Base.Software] = "Pillow"
    im.save("photo-with-software.jpg", exif=exif.tobytes())
```

Side effect: writes a JPEG containing the updated `Software` EXIF tag.

Decode light-source values safely:

```python
from PIL import Image
from PIL.ExifTags import Base, LightSource

with Image.open("photo.jpg") as im:
    value = im.getexif().get(Base.LightSource)

label = LightSource(value).name if value in LightSource._value2member_map_ else value
print(label)
```

Output: light-source label such as `Daylight`, `Flash`, `D65`, or the raw value if Pillow has no enum member.

## Error handling

| Symptom | Likely cause | Fix |
|---|---|---|
| `AttributeError: 'int' object has no attribute 'items'` | Code treats `exif[GPSInfo]` or a `TAGS`-labeled `GPSInfo` value as the nested GPS IFD. Modern Pillow keeps GPS IFD data behind `Exif.get_ifd()`. | Use `exif.get_ifd(ExifTags.IFD.GPSInfo)` and decode keys with `GPSTAGS.get(tag_id, tag_id)`. |
| `AttributeError: module 'PIL.ExifTags' has no attribute 'Base'` | Pillow older than `9.3.0`; `Base` and `GPS` enums were not present. | Upgrade Pillow, or fall back to `TAGS` and `GPSTAGS` on old environments. |
| `AttributeError: module 'PIL.ExifTags' has no attribute 'IFD'` | Pillow version predates the `IFD` enum addition. | Upgrade Pillow, or call `exif.get_ifd(0x8769)`, `exif.get_ifd(0x8825)`, `exif.get_ifd(0x927C)`, or `exif.get_ifd(0xA005)` with raw constants. |
| `AttributeError: module 'PIL.ExifTags' has no attribute 'LightSource'` | Pillow version predates the `LightSource` enum addition. | Upgrade Pillow, or keep the raw `Base.LightSource` integer value. |
| `ValueError` from `Image.save()` when writing edited EXIF | Output format cannot be determined from the filename or file object. | Supply a file extension or pass `format="JPEG"`/the intended format explicitly. |
| `OSError` from `Image.save()` when writing edited EXIF | Output file cannot be written; Pillow may leave a partial file. | Check parent directory existence, permissions, disk space, and binary-mode file object handling. |
| `ValueError: EXIF data is too long` | JPEG EXIF payload exceeds Pillow's supported save size. | Remove oversized EXIF entries such as MakerNote/thumbnail payloads, reduce metadata, or use a metadata-specific tool such as ExifTool for the write. |

## Traps

_Append-only. Date-stamped. Filled by the operator via the `/lesson`
slash command when something bites._

## Lessons

_Append-only. Date-stamped. Filled by the operator via the `/lesson`
slash command for behaviors learned that aren't in upstream docs._
