---
name: tool-faster-whisper
description: Load when working with faster-whisper, WhisperModel transcription, CTranslate2 compute types, VAD filtering, word timestamps, model conversion, or whisper-ctranslate2. Covers API surface, setup, workflows, and error handling.
triggers:
  bash:
    - faster-whisper
    - faster_whisper
    - whisper-ctranslate2
    - WhisperModel
    - BatchedInferencePipeline
---

# faster-whisper

## What it is

A Python speech-to-text library that reimplements OpenAI Whisper inference with CTranslate2. It solves local transcription and English translation of audio with lower memory use, quantized CPU/GPU execution, VAD filtering, word timestamps, batching, and Hugging Face-hosted converted Whisper models. Reach for it when Python code needs Whisper inference without the OpenAI Whisper runtime; common alternatives are `openai/whisper`, `whisper.cpp`, `transformers`, and WhisperX. The `faster-whisper` package does not install a first-party console script; `whisper-ctranslate2` is a separate CLI client based on faster-whisper.

## Capability surface

### Installable package

| Item | Surface |
|---|---|
| Distribution name | `faster-whisper` |
| Import name | `faster_whisper` |
| Python requirement | `>=3.9` |
| Runtime dependencies | `ctranslate2>=4.0,<5`, `huggingface_hub>=0.23`, `tokenizers>=0.13,<1`, `onnxruntime>=1.14,<2`, `av>=11`, `tqdm` |
| Conversion extra | `transformers[torch]>=4.23` via `faster-whisper[conversion]` |
| Console scripts | None in the `faster-whisper` wheel |
| Related CLI trigger | `whisper-ctranslate2` package, separate project |

### `faster_whisper.__all__`

```python
from faster_whisper import (
    available_models,
    decode_audio,
    WhisperModel,
    BatchedInferencePipeline,
    download_model,
    format_timestamp,
    __version__,
)
```

| Export | Kind | Purpose |
|---|---|---|
| `available_models()` | function | Return built-in model aliases accepted by `WhisperModel` and `download_model`. |
| `decode_audio()` | function | Decode audio input to a float32 NumPy waveform with PyAV. |
| `WhisperModel` | class | Main non-batched transcription API. |
| `BatchedInferencePipeline` | class | Batched transcription wrapper around an existing `WhisperModel`. |
| `download_model()` | function | Download CTranslate2 Whisper model files from Hugging Face Hub. |
| `format_timestamp()` | function | Format seconds as Whisper-style timestamps. |
| `__version__` | string | Package version string. |

### Built-in model aliases

`available_models()` returns the keys in this map. Passing one of these aliases to `WhisperModel(model_size_or_path=...)` downloads the mapped CTranslate2 model from Hugging Face unless already cached.

| Alias | Hugging Face model ID |
|---|---|
| `tiny.en` | `Systran/faster-whisper-tiny.en` |
| `tiny` | `Systran/faster-whisper-tiny` |
| `base.en` | `Systran/faster-whisper-base.en` |
| `base` | `Systran/faster-whisper-base` |
| `small.en` | `Systran/faster-whisper-small.en` |
| `small` | `Systran/faster-whisper-small` |
| `medium.en` | `Systran/faster-whisper-medium.en` |
| `medium` | `Systran/faster-whisper-medium` |
| `large-v1` | `Systran/faster-whisper-large-v1` |
| `large-v2` | `Systran/faster-whisper-large-v2` |
| `large-v3` | `Systran/faster-whisper-large-v3` |
| `large` | `Systran/faster-whisper-large-v3` |
| `distil-small.en` | `Systran/faster-distil-whisper-small.en` |
| `distil-medium.en` | `Systran/faster-distil-whisper-medium.en` |
| `distil-large-v2` | `Systran/faster-distil-whisper-large-v2` |
| `distil-large-v3` | `Systran/faster-distil-whisper-large-v3` |
| `distil-large-v3.5` | `distil-whisper/distil-large-v3.5-ct2` |
| `large-v3-turbo` | `mobiuslabsgmbh/faster-whisper-large-v3-turbo` |
| `turbo` | `mobiuslabsgmbh/faster-whisper-large-v3-turbo` |

### Top-level functions

```python
available_models() -> List[str]
```

Returns the built-in model aliases listed above.

```python
download_model(
    size_or_id: str,
    output_dir: Optional[str] = None,
    local_files_only: bool = False,
    cache_dir: Optional[str] = None,
    revision: Optional[str] = None,
    use_auth_token: Optional[Union[str, bool]] = None,
)
```

| Parameter | Meaning |
|---|---|
| `size_or_id` | Built-in size alias or Hugging Face repo ID such as `Systran/faster-whisper-large-v3`. |
| `output_dir` | Local directory for model files. If unset, Hugging Face cache is used. |
| `local_files_only` | Avoid network; return cached path only. |
| `cache_dir` | Hugging Face cache directory override. |
| `revision` | Branch, tag, or commit. |
| `use_auth_token` | Hugging Face token string or `True` to use locally stored token. |

Downloaded file allowlist: `config.json`, `preprocessor_config.json`, `model.bin`, `tokenizer.json`, `vocabulary.*`.

```python
decode_audio(
    input_file: Union[str, BinaryIO],
    sampling_rate: int = 16000,
    split_stereo: bool = False,
)
```

| Parameter | Meaning |
|---|---|
| `input_file` | Path or file-like object. |
| `sampling_rate` | Resample target rate. Default `16000`. |
| `split_stereo` | Return `(left_channel, right_channel)` instead of mono. |

Returns `np.ndarray` float32 samples normalized to `[-1, 1]`, or a 2-tuple of arrays when `split_stereo=True`.

```python
format_timestamp(
    seconds: float,
    always_include_hours: bool = False,
    decimal_marker: str = ".",
) -> str
```

Formats a non-negative second count as `MM:SS.mmm` or `HH:MM:SS.mmm`.

### `WhisperModel`

```python
class WhisperModel:
    def __init__(
        self,
        model_size_or_path: str,
        device: str = "auto",
        device_index: Union[int, List[int]] = 0,
        compute_type: str = "default",
        cpu_threads: int = 0,
        num_workers: int = 1,
        download_root: Optional[str] = None,
        local_files_only: bool = False,
        files: dict = None,
        revision: Optional[str] = None,
        use_auth_token: Optional[Union[str, bool]] = None,
        **model_kwargs,
    )
```

| Parameter | Accepted values / behavior |
|---|---|
| `model_size_or_path` | Built-in alias (`tiny`, `base`, `small`, `medium`, `large-v3`, `turbo`, distil aliases), local CTranslate2 model directory, or Hugging Face CTranslate2 model ID. |
| `device` | `"cpu"`, `"cuda"`, `"auto"`. |
| `device_index` | Integer GPU/device index or list of indices for multiple GPUs. |
| `compute_type` | CTranslate2 compute type: `default`, `auto`, `int8`, `int8_float32`, `int8_float16`, `int8_bfloat16`, `int16`, `float16`, `bfloat16`, `float32`. |
| `cpu_threads` | CPU OpenMP threads. Nonzero overrides `OMP_NUM_THREADS`. |
| `num_workers` | Number of model workers; enables parallel `transcribe()` calls from multiple Python threads at higher memory cost. |
| `download_root` | Directory for downloaded model files. If unset, Hugging Face cache is used. |
| `local_files_only` | Use cached/local files only. |
| `files` | In-memory model files keyed by filename; `model_size_or_path` becomes identifier. |
| `revision` | Hugging Face branch, tag, or commit. |
| `use_auth_token` | Hugging Face token string or `True` to use stored token. |
| `**model_kwargs` | Passed to `ctranslate2.models.Whisper`, e.g. `flash_attention`, `tensor_parallel`, `max_queued_batches`. |

Instance attributes established by initialization:

| Attribute | Meaning |
|---|---|
| `model` | Underlying `ctranslate2.models.Whisper`. |
| `hf_tokenizer` | `tokenizers.Tokenizer` loaded from model files or OpenAI Whisper tokenizer fallback. |
| `feature_extractor` | `FeatureExtractor` configured from `preprocessor_config.json` when present. |
| `feat_kwargs` | Preprocessor config filtered to `FeatureExtractor.__init__` keys. |
| `input_stride` | `2`. |
| `num_samples_per_token` | `feature_extractor.hop_length * input_stride`. |
| `frames_per_second` | `sampling_rate // hop_length`; normally `100`. |
| `tokens_per_second` | `sampling_rate // num_samples_per_token`; normally `50`. |
| `time_precision` | `0.02`. |
| `max_length` | `448`. |

```python
@property
def supported_languages(self) -> List[str]
```

Returns all Whisper language codes for multilingual models, or `['en']` for English-only models.

```python
def transcribe(
    self,
    audio: Union[str, BinaryIO, np.ndarray],
    language: Optional[str] = None,
    task: str = "transcribe",
    log_progress: bool = False,
    beam_size: int = 5,
    best_of: int = 5,
    patience: float = 1,
    length_penalty: float = 1,
    repetition_penalty: float = 1,
    no_repeat_ngram_size: int = 0,
    temperature: Union[float, List[float], Tuple[float, ...]] = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
    compression_ratio_threshold: Optional[float] = 2.4,
    log_prob_threshold: Optional[float] = -1.0,
    no_speech_threshold: Optional[float] = 0.6,
    condition_on_previous_text: bool = True,
    prompt_reset_on_temperature: float = 0.5,
    initial_prompt: Optional[Union[str, Iterable[int]]] = None,
    prefix: Optional[str] = None,
    suppress_blank: bool = True,
    suppress_tokens: Optional[List[int]] = [-1],
    without_timestamps: bool = False,
    max_initial_timestamp: float = 1.0,
    word_timestamps: bool = False,
    prepend_punctuations: str = "\"'“¿([{-",
    append_punctuations: str = "\"'.。,，!！?？:：”)]}、",
    multilingual: bool = False,
    vad_filter: bool = False,
    vad_parameters: Optional[Union[dict, VadOptions]] = None,
    max_new_tokens: Optional[int] = None,
    chunk_length: Optional[int] = None,
    clip_timestamps: Union[str, List[float]] = "0",
    hallucination_silence_threshold: Optional[float] = None,
    hotwords: Optional[str] = None,
    language_detection_threshold: Optional[float] = 0.5,
    language_detection_segments: int = 1,
) -> Tuple[Iterable[Segment], TranscriptionInfo]
```

| Parameter | Meaning |
|---|---|
| `audio` | Audio file path, file-like object, or 1D float NumPy waveform sampled at 16 kHz. |
| `language` | Language code such as `en`, `fr`, `de`; detected from initial audio when unset. |
| `task` | `transcribe` or `translate`. Translate outputs English. |
| `log_progress` | Show `tqdm` progress. |
| `beam_size` | Beam size for decoding. Default `5`. |
| `best_of` | Candidate count when sampling with nonzero temperature. |
| `patience` | Beam search patience factor. |
| `length_penalty` | Exponential length penalty. |
| `repetition_penalty` | Penalize previously generated tokens when `>1`. |
| `no_repeat_ngram_size` | Prevent repeated n-grams of this size; `0` disables. |
| `temperature` | Float or sequence of fallback temperatures tried on threshold failure. |
| `compression_ratio_threshold` | Treat segment as failed when gzip compression ratio exceeds threshold. |
| `log_prob_threshold` | Treat segment as failed when average log probability is below threshold. |
| `no_speech_threshold` | Treat segment as silent when no-speech probability is high and log probability is below threshold. |
| `condition_on_previous_text` | Feed prior window text as next prompt. Disable to reduce repetition loops/timestamp drift. |
| `prompt_reset_on_temperature` | Reset prompt when fallback temperature exceeds this value. |
| `initial_prompt` | Text or token IDs used only before first window. |
| `prefix` | Text prefix for first window. |
| `suppress_blank` | Suppress blank outputs at beginning. |
| `suppress_tokens` | Token IDs to suppress; `[-1]` expands to default non-speech tokens. |
| `without_timestamps` | Sample only text tokens. |
| `max_initial_timestamp` | Maximum allowed first timestamp. |
| `word_timestamps` | Add word-level timestamps using cross-attention alignment and dynamic time warping. |
| `prepend_punctuations` | Punctuation merged into the following word when `word_timestamps=True`. |
| `append_punctuations` | Punctuation merged into previous word when `word_timestamps=True`. |
| `multilingual` | Detect language on every segment. Disabled automatically for English-only models. |
| `vad_filter` | Enable Silero VAD preprocessing. Default `False` for `WhisperModel`. |
| `vad_parameters` | `VadOptions` or dict accepted by `VadOptions`. |
| `max_new_tokens` | Maximum generated tokens per chunk; must fit inside model `max_length`. |
| `chunk_length` | Audio chunk length in seconds; overrides feature extractor default. |
| `clip_timestamps` | Comma-separated `start,end,start,end,...` seconds or list of floats. Last end defaults to file end. Disables VAD. |
| `hallucination_silence_threshold` | Skip silent periods longer than this threshold when word timestamps detect likely hallucination. |
| `hotwords` | Hint phrases; no effect when `prefix` is set. |
| `language_detection_threshold` | Probability threshold for accepting a detected language. |
| `language_detection_segments` | Number of 30-second segments to consider for language detection. |

Return value: `(segments, info)`. `segments` is a generator; transcription starts only when iterated or materialized.

```python
def detect_language(
    self,
    audio: Optional[np.ndarray] = None,
    features: Optional[np.ndarray] = None,
    vad_filter: bool = False,
    vad_parameters: Union[dict, VadOptions] = None,
    language_detection_segments: int = 1,
    language_detection_threshold: float = 0.5,
) -> Tuple[str, float, List[Tuple[str, float]]]
```

Requires `audio` or `features`. Returns `(language, language_probability, all_language_probs)`.

```python
def encode(self, features: np.ndarray) -> ctranslate2.StorageView
```

Converts a 2D or batched Mel feature array to `ctranslate2.StorageView` and calls the CTranslate2 encoder. Moves encoder output to CPU when running a model across multiple CUDA devices.

```python
def generate_segments(
    self,
    features: np.ndarray,
    tokenizer: Tokenizer,
    options: TranscriptionOptions,
    log_progress,
    encoder_output: Optional[ctranslate2.StorageView] = None,
) -> Iterable[Segment]
```

Internal-facing generator that implements sliding-window decoding, timestamp splitting, fallback temperatures, hallucination skip logic, word timestamp insertion, and prompt reset behavior.

```python
def generate_with_fallback(
    self,
    encoder_output: ctranslate2.StorageView,
    prompt: List[int],
    tokenizer: Tokenizer,
    options: TranscriptionOptions,
) -> Tuple[ctranslate2.models.WhisperGenerationResult, float, float, float]
```

Runs CTranslate2 generation and retries temperatures until compression/log-probability thresholds pass. Returns generation result, average log probability, selected temperature, and compression ratio.

```python
def get_prompt(
    self,
    tokenizer: Tokenizer,
    previous_tokens: List[int],
    without_timestamps: bool = False,
    prefix: Optional[str] = None,
    hotwords: Optional[str] = None,
) -> List[int]
```

Builds Whisper prompt tokens from prior tokens, SOT sequence, timestamp suppression, prefix, and hotwords.

```python
def add_word_timestamps(
    self,
    segments: List[dict],
    tokenizer: Tokenizer,
    encoder_output: ctranslate2.StorageView,
    num_frames: int,
    prepend_punctuations: str,
    append_punctuations: str,
    last_speech_timestamp: float,
) -> float
```

Adds `words` arrays to segment dictionaries. Returns updated last speech timestamp.

```python
def find_alignment(
    self,
    tokenizer: Tokenizer,
    text_tokens: List[int],
    encoder_output: ctranslate2.StorageView,
    num_frames: int,
    median_filter_width: int = 7,
) -> List[dict]
```

Calls CTranslate2 `Whisper.align()` and returns word timing dictionaries.

### `BatchedInferencePipeline`

```python
class BatchedInferencePipeline:
    def __init__(self, model)
```

Wrap an existing `WhisperModel`. `BatchedInferencePipeline.transcribe()` is intended as a drop-in replacement for `WhisperModel.transcribe()` with additional `batch_size` and batched chunk decoding. VAD is enabled by default for batched transcription.

```python
def transcribe(
    self,
    audio: Union[str, BinaryIO, np.ndarray],
    language: Optional[str] = None,
    task: str = "transcribe",
    log_progress: bool = False,
    beam_size: int = 5,
    best_of: int = 5,
    patience: float = 1,
    length_penalty: float = 1,
    repetition_penalty: float = 1,
    no_repeat_ngram_size: int = 0,
    temperature: Union[float, List[float], Tuple[float, ...]] = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
    compression_ratio_threshold: Optional[float] = 2.4,
    log_prob_threshold: Optional[float] = -1.0,
    no_speech_threshold: Optional[float] = 0.6,
    condition_on_previous_text: bool = True,
    prompt_reset_on_temperature: float = 0.5,
    initial_prompt: Optional[Union[str, Iterable[int]]] = None,
    prefix: Optional[str] = None,
    suppress_blank: bool = True,
    suppress_tokens: Optional[List[int]] = [-1],
    without_timestamps: bool = True,
    max_initial_timestamp: float = 1.0,
    word_timestamps: bool = False,
    prepend_punctuations: str = "\"'“¿([{-",
    append_punctuations: str = "\"'.。,，!！?？:：”)]}、",
    multilingual: bool = False,
    vad_filter: bool = True,
    vad_parameters: Optional[Union[dict, VadOptions]] = None,
    max_new_tokens: Optional[int] = None,
    chunk_length: Optional[int] = None,
    clip_timestamps: Optional[List[dict]] = None,
    hallucination_silence_threshold: Optional[float] = None,
    batch_size: int = 8,
    hotwords: Optional[str] = None,
    language_detection_threshold: Optional[float] = 0.5,
    language_detection_segments: int = 1,
) -> Tuple[Iterable[Segment], TranscriptionInfo]
```

Differences from `WhisperModel.transcribe()`:

| Difference | Batched behavior |
|---|---|
| `vad_filter` default | `True`. |
| `without_timestamps` default | `True`. |
| `clip_timestamps` type | `Optional[List[dict]]`, each dict containing `start` and `end` seconds. |
| `batch_size` | Maximum number of parallel chunk decoding requests. Default `8`. |
| Fallback thresholds | `compression_ratio_threshold`, `log_prob_threshold`, `no_speech_threshold`, `condition_on_previous_text`, `prompt_reset_on_temperature`, `prefix`, and `hallucination_silence_threshold` are accepted but not used by the batched path. |

```python
def forward(self, features, tokenizer, chunks_metadata, options)
```

Runs batched generation and splits generated tokens into segment dictionaries.

```python
def generate_segment_batched(
    self,
    features: np.ndarray,
    tokenizer: Tokenizer,
    options: TranscriptionOptions,
)
```

Encodes the batch, builds prompts, optionally applies per-segment language detection, and calls CTranslate2 `generate()`.

### Transcription dataclasses

```python
@dataclass
class Word:
    start: float
    end: float
    word: str
    probability: float
```

`Word._asdict()` exists but is deprecated; use `dataclasses.asdict(word)`.

```python
@dataclass
class Segment:
    id: int
    seek: int
    start: float
    end: float
    text: str
    tokens: List[int]
    avg_logprob: float
    compression_ratio: float
    no_speech_prob: float
    words: Optional[List[Word]]
    temperature: Optional[float]
```

`Segment._asdict()` exists but is deprecated; use `dataclasses.asdict(segment)`.

```python
@dataclass
class TranscriptionOptions:
    beam_size: int
    best_of: int
    patience: float
    length_penalty: float
    repetition_penalty: float
    no_repeat_ngram_size: int
    log_prob_threshold: Optional[float]
    no_speech_threshold: Optional[float]
    compression_ratio_threshold: Optional[float]
    condition_on_previous_text: bool
    prompt_reset_on_temperature: float
    temperatures: List[float]
    initial_prompt: Optional[Union[str, Iterable[int]]]
    prefix: Optional[str]
    suppress_blank: bool
    suppress_tokens: Optional[List[int]]
    without_timestamps: bool
    max_initial_timestamp: float
    word_timestamps: bool
    prepend_punctuations: str
    append_punctuations: str
    multilingual: bool
    max_new_tokens: Optional[int]
    clip_timestamps: Union[str, List[float]]
    hallucination_silence_threshold: Optional[float]
    hotwords: Optional[str]
```

```python
@dataclass
class TranscriptionInfo:
    language: str
    language_probability: float
    duration: float
    duration_after_vad: float
    all_language_probs: Optional[List[Tuple[str, float]]]
    transcription_options: TranscriptionOptions
    vad_options: VadOptions
```

### VAD API: `faster_whisper.vad`

```python
@dataclass
class VadOptions:
    threshold: float = 0.5
    neg_threshold: float = None
    min_speech_duration_ms: int = 0
    max_speech_duration_s: float = float("inf")
    min_silence_duration_ms: int = 2000
    speech_pad_ms: int = 400
    min_silence_at_max_speech: int = 98
    use_max_poss_sil_at_max_speech: bool = True
```

| Field | Meaning |
|---|---|
| `threshold` | Speech probability above this value is considered speech. |
| `neg_threshold` | Silence threshold for ending speech. If unset, `max(threshold - 0.15, 0.01)`. |
| `min_speech_duration_ms` | Final speech chunks shorter than this are discarded. |
| `max_speech_duration_s` | Maximum speech chunk length before splitting. |
| `min_silence_duration_ms` | Silence duration required before separating speech chunks. |
| `speech_pad_ms` | Padding added to final speech chunks. |
| `min_silence_at_max_speech` | Minimum silence used to avoid abrupt cuts when max duration is reached. |
| `use_max_poss_sil_at_max_speech` | Use maximum possible silence rather than last silence at max duration. |

```python
def get_speech_timestamps(
    audio: np.ndarray,
    vad_options: Optional[VadOptions] = None,
    sampling_rate: int = 16000,
    **kwargs,
) -> List[dict]
```

Splits a 1D float waveform into Silero VAD speech chunks. Returns `[{"start": sample_index, "end": sample_index}, ...]`.

```python
def collect_chunks(
    audio: np.ndarray,
    chunks: List[dict],
    sampling_rate: int = 16000,
    max_duration: float = float("inf"),
) -> Tuple[List[np.ndarray], List[Dict[str, float]]]
```

Merges VAD chunks into audio arrays no longer than `max_duration` seconds and returns `(audio_chunks, chunks_metadata)`.

```python
class SpeechTimestampsMap:
    def __init__(self, chunks: List[dict], sampling_rate: int, time_precision: int = 2)
    def get_original_time(self, time: float, chunk_index: Optional[int] = None, is_end: bool = False) -> float
    def get_chunk_index(self, time: float, is_end: bool = False) -> int
```

Maps VAD-compressed timestamps back to original audio timestamps.

```python
def get_vad_model()
```

Returns cached `SileroVADModel` loaded from packaged `assets/silero_vad_v6.onnx`.

```python
class SileroVADModel:
    def __init__(self, path)
    def __call__(self, audio: np.ndarray, num_samples: int = 512, context_size_samples: int = 64)
```

Runs the ONNX VAD model on padded 1D audio.

### Audio helpers: `faster_whisper.audio`

```python
def decode_audio(
    input_file: Union[str, BinaryIO],
    sampling_rate: int = 16000,
    split_stereo: bool = False,
)
```

Uses PyAV to decode and resample audio. PyAV bundles FFmpeg libraries; system FFmpeg is not required by this package.

```python
def pad_or_trim(array, length: int = 3000, *, axis: int = -1)
```

Pads or trims a feature array along `axis` to `length`, defaulting to the Whisper encoder length `3000`.

### Feature extraction: `faster_whisper.feature_extractor`

```python
class FeatureExtractor:
    def __init__(
        self,
        feature_size=80,
        sampling_rate=16000,
        hop_length=160,
        chunk_length=30,
        n_fft=400,
    )
```

| Attribute | Default / meaning |
|---|---|
| `feature_size` | Mel bands, default `80`. |
| `sampling_rate` | Default `16000`. |
| `hop_length` | Default `160`. |
| `chunk_length` | Default `30` seconds. |
| `n_fft` | Default `400`. |
| `n_samples` | `chunk_length * sampling_rate`. |
| `nb_max_frames` | `n_samples // hop_length`. |
| `time_per_frame` | `hop_length / sampling_rate`. |
| `mel_filters` | Slaney-style Mel filter weights. |

```python
@staticmethod
def get_mel_filters(sr, n_fft, n_mels=128)
```

Builds Mel filter bank weights.

```python
@staticmethod
def stft(
    input_array: np.ndarray,
    n_fft: int,
    hop_length: int = None,
    win_length: int = None,
    window: np.ndarray = None,
    center: bool = True,
    mode: str = "reflect",
    normalized: bool = False,
    onesided: bool = None,
    return_complex: bool = None,
)
```

Computes short-time Fourier transform.

```python
def __call__(self, waveform: np.ndarray, padding=160, chunk_length=None)
```

Computes log-Mel spectrogram from a waveform. If `chunk_length` is provided, updates `n_samples` and `nb_max_frames` for that call.

### Tokenizer wrapper: `faster_whisper.tokenizer`

```python
class Tokenizer:
    def __init__(
        self,
        tokenizer: tokenizers.Tokenizer,
        multilingual: bool,
        task: Optional[str] = None,
        language: Optional[str] = None,
    )
```

| Property / method | Purpose |
|---|---|
| `transcribe` | Token ID for `<|transcribe|>`. |
| `translate` | Token ID for `<|translate|>`. |
| `sot` | Token ID for `<|startoftranscript|>`. |
| `sot_lm` | Token ID for `<|startoflm|>`. |
| `sot_prev` | Token ID for `<|startofprev|>`. |
| `eot` | Token ID for `<|endoftext|>`. |
| `no_timestamps` | Token ID for `<|notimestamps|>`. |
| `no_speech` | Token ID for `<|nospeech|>` or `<|nocaptions|>`. |
| `timestamp_begin` | First timestamp token ID. |
| `sot_sequence` | Start-of-transcript token sequence including language/task when multilingual. |
| `encode(text: str) -> List[int]` | Tokenize text without special tokens. |
| `decode(tokens: List[int]) -> str` | Decode tokens below `eot`. |
| `decode_with_timestamps(tokens: List[int]) -> str` | Decode text and render timestamp tokens as `<|N.NN|>`. |
| `non_speech_tokens -> Tuple[int]` | Token IDs suppressed by default non-speech filtering. |
| `split_to_word_tokens(tokens: List[int]) -> Tuple[List[str], List[List[int]]]` | Split decoded tokens into word/token groups; Unicode splitting for CJK/Thai/Lao/Burmese/Yue. |
| `split_tokens_on_unicode(tokens: List[int])` | Split when tokens form valid Unicode boundaries. |
| `split_tokens_on_spaces(tokens: List[int])` | Split word tokens on spaces/punctuation. |

Accepted `task` values: `transcribe`, `translate`.

Accepted language codes:

```text
af am ar as az ba be bg bn bo br bs ca cs cy da de el en es et eu fa fi fo fr gl gu ha haw he hi hr ht hu hy id is it ja jw ka kk km kn ko la lb ln lo lt lv mg mi mk ml mn mr ms mt my ne nl nn no oc pa pl ps pt ro ru sa sd si sk sl sn so sq sr su sv sw ta te tg th tk tl tr tt uk ur uz vi yi yo zh yue
```

### Utility module: `faster_whisper.utils`

```python
def available_models() -> List[str]
def get_assets_path()
def get_logger()
def download_model(...)
def format_timestamp(...)
def get_end(segments: List[dict]) -> Optional[float]
class disabled_tqdm(tqdm)
```

| Utility | Purpose |
|---|---|
| `get_assets_path()` | Return package `assets` directory path. |
| `get_logger()` | Return `logging.getLogger("faster_whisper")`. |
| `get_end(segments)` | Return last word end timestamp when present, otherwise last segment end. |
| `disabled_tqdm` | `tqdm` subclass that forces `disable=True`. |

### CTranslate2 surface used through `WhisperModel.model`

`WhisperModel.model` is a `ctranslate2.models.Whisper` instance. CTranslate2 methods and properties are reachable through it.

| CTranslate2 API | Signature / values |
|---|---|
| `Whisper.__init__` | `Whisper(model_path: str, device: str='cpu', *, device_index: Union[int, List[int]]=0, compute_type: Union[str, Dict[str, str]]='default', inter_threads: int=1, intra_threads: int=0, max_queued_batches: int=0, flash_attention: bool=False, tensor_parallel: bool=False, files: object=None)` |
| `align` | `align(features, start_sequence, text_tokens, num_frames, *, median_filter_width=7)` |
| `detect_language` | `detect_language(features)`; multilingual models only. |
| `encode` | `encode(features, to_cpu: bool=False)` |
| `generate` | `generate(features, prompts, *, asynchronous=False, beam_size=5, patience=1, num_hypotheses=1, length_penalty=1, repetition_penalty=1, no_repeat_ngram_size=0, max_length=448, return_scores=False, return_logits_vocab=False, return_no_speech_prob=False, max_initial_timestamp_index=50, suppress_blank=True, suppress_tokens=[-1], sampling_topk=1, sampling_temperature=1)` |
| `load_model` | `load_model(keep_cache: bool=False)` |
| `unload_model` | `unload_model(to_cpu: bool=False)` |
| Properties | `compute_type`, `device`, `device_index`, `is_multilingual`, `model_is_loaded`, `n_mels`, `num_active_batches`, `num_languages`, `num_queued_batches`, `num_workers`, `tensor_parallel` |

### Compute types and quantization

| `compute_type` | Meaning / normal use |
|---|---|
| `default` | Use the model's saved quantization unless runtime converts for unsupported hardware. |
| `auto` | Select fastest supported computation type for the system/device. |
| `int8` | 8-bit weights; non-quantized layers use original model precision unless more specific type is selected. |
| `int8_float32` | 8-bit weights; non-quantized layers run in FP32. |
| `int8_float16` | 8-bit weights; non-quantized layers run in FP16. Common GPU setting. |
| `int8_bfloat16` | 8-bit weights; non-quantized layers run in BF16. |
| `int16` | 16-bit integer weights; Intel CPU-oriented. |
| `float16` | FP16 weights/layers; NVIDIA GPU compute capability `>=7.0`. |
| `bfloat16` | BF16 weights/layers; NVIDIA GPU compute capability `>=8.0`. |
| `float32` | FP32 execution; safe CPU fallback and older-GPU fallback. |

### Related CLI: `whisper-ctranslate2`

`whisper-ctranslate2` is not installed by `faster-whisper`. It is a separate package that exposes a Whisper-compatible command line client using CTranslate2 and faster-whisper.

Canonical invocation shape:

```bash
whisper-ctranslate2 AUDIO_FILE [OpenAI-Whisper-compatible options] [CTranslate2/faster-whisper options]
```

Documented related options:

| Option | Values / behavior |
|---|---|
| `--model MODEL` | Whisper model name for CLI transcription. |
| `--task {transcribe,translate}` | `translate` translates source language to English. |
| `--device DEVICE` | Manually select device instead of best available hardware. |
| `--device_index INDEX` | Manually select device index. |
| `--batched True` | Enable batched inference. |
| `--batch_size N` | Maximum parallel decoding requests for batched inference. |
| `--compute_type TYPE` | `default`, `auto`, `int8`, `int8_float16`, `int16`, `float16`, `float32`. |
| `--model_directory PATH` | Load local CTranslate2 Whisper model directory. |
| `--vad_filter True` | Enable Silero VAD. |
| `--vad_onset VALUE` | VAD speech probability onset threshold. |
| `--vad_min_speech_duration_ms N` | Drop speech chunks shorter than this. |
| `--vad_max_speech_duration_s N` | Split speech chunks longer than this. |
| `--print_colors True` | Print confidence-colored text. |
| `--live_transcribe True` | Microphone live transcription mode. |
| `--hf_token TOKEN_NAME_OR_VALUE` | Hugging Face token for diarization/private-gated resources; do not inline real tokens in logs or skills. |
| `--speaker_name SPEAKER_NAME` | Speaker label override for diarization output. |

### Model conversion surface

The README-supported conversion path uses CTranslate2's Transformers converter:

```bash
pip install 'faster-whisper[conversion]'
ct2-transformers-converter \
  --model openai/whisper-large-v3 \
  --output_dir whisper-large-v3-ct2 \
  --copy_files tokenizer.json preprocessor_config.json \
  --quantization float16
```

| Converter option | Meaning |
|---|---|
| `--model MODEL_OR_PATH` | Hugging Face model ID or local Transformers-compatible model directory. |
| `--output_dir DIR` | Converted CTranslate2 model output directory. |
| `--copy_files FILE...` | Copy required tokenizer/preprocessor files into output directory. Use at least `tokenizer.json preprocessor_config.json` for Whisper. |
| `--quantization TYPE` | Save converted weights as `int8`, `int8_float32`, `int8_float16`, `int8_bfloat16`, `int16`, `float16`, `bfloat16`, or `float32`. |

Load converted models through `WhisperModel("path/to/model")` or `WhisperModel("username/model-id")` after uploading to Hugging Face Hub.

## Setup & auth

Install the Python package:

```bash
python -m pip install faster-whisper
```

Install conversion dependencies when converting OpenAI/Transformers Whisper models:

```bash
python -m pip install 'faster-whisper[conversion]'
```

Install the related CLI only when command-line compatibility is needed:

```bash
python -m pip install whisper-ctranslate2
```

GPU execution setup:

| Runtime | Requirements / notes |
|---|---|
| Current faster-whisper / CTranslate2 releases | CUDA 12 and cuDNN 9 for CUDA 12. |
| CUDA 11 + cuDNN 8 workaround | Pin `ctranslate2==3.24.0`. |
| CUDA 12 + cuDNN 8 workaround | Pin `ctranslate2==4.4.0`. |
| Linux pip-installed NVIDIA libs | `pip install nvidia-cublas-cu12 nvidia-cudnn-cu12==9.*` then set `LD_LIBRARY_PATH` before Python starts. |
| Docker | Use NVIDIA CUDA runtime images containing cuBLAS/cuDNN, or CTranslate2 CUDA images, with NVIDIA Container Toolkit. |
| Windows | CUDA/cuDNN DLL directories must be on `PATH`; Visual C++ runtime may be required by CTranslate2. |
| CPU | Use `device="cpu"`, typically `compute_type="int8"` for speed/memory. |

No system FFmpeg install is required for normal audio decoding; PyAV bundles FFmpeg libraries.

Credentials and secrets:

| Credential | Source | Use |
|---|---|---|
| Hugging Face access token | Hugging Face account settings / `huggingface-cli login` | Private/gated model downloads via `use_auth_token=True` or a token string. |
| `HF_TOKEN` / locally stored token | Environment or Hugging Face config | Avoid inline token literals in code, commands, logs, skills, or lessons. |
| `whisper-ctranslate2 --hf_token` | Hugging Face token | Diarization or gated pyannote resources in the separate CLI. |

State locations:

| State | Location / override |
|---|---|
| Downloaded model cache | Standard Hugging Face Hub cache unless `download_root` / `cache_dir` / `output_dir` is provided. |
| Local converted models | Operator-selected `--output_dir`, loaded by path. |
| VAD model asset | Packaged under `faster_whisper/assets/silero_vad_v6.onnx`. |
| Library config | No persistent `faster-whisper` config file. |
| Logging | Standard Python logger named `faster_whisper`. |

## Common workflows

Transcribe with GPU FP16:

```python
from faster_whisper import WhisperModel

model = WhisperModel("large-v3", device="cuda", compute_type="float16")
segments, info = model.transcribe("audio.mp3", beam_size=5)

print(f"Detected language {info.language!r} with probability {info.language_probability:.3f}")
for segment in segments:
    print(f"[{segment.start:.2f}s -> {segment.end:.2f}s] {segment.text}")
```

Output: lazy `segments` generator plus `TranscriptionInfo`; transcription starts when iterating.

Run on CPU with INT8:

```python
from faster_whisper import WhisperModel

model = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=4)
segments, info = model.transcribe("audio.mp3", beam_size=5)
segments = list(segments)
```

Output: local CPU transcription; model files are downloaded to Hugging Face cache unless already present.

Run batched transcription:

```python
from faster_whisper import BatchedInferencePipeline, WhisperModel

model = WhisperModel("turbo", device="cuda", compute_type="float16")
batched_model = BatchedInferencePipeline(model=model)
segments, info = batched_model.transcribe("audio.mp3", batch_size=16)
for segment in segments:
    print(f"[{segment.start:.2f}s -> {segment.end:.2f}s] {segment.text}")
```

Output: faster chunk decoding; VAD enabled by default for the batched path.

Word timestamps with custom VAD silence threshold:

```python
from faster_whisper import WhisperModel

model = WhisperModel("medium", device="cuda", compute_type="int8_float16")
segments, _ = model.transcribe(
    "audio.mp3",
    word_timestamps=True,
    vad_filter=True,
    vad_parameters={"min_silence_duration_ms": 500},
)
for segment in segments:
    for word in segment.words or []:
        print(f"[{word.start:.2f}s -> {word.end:.2f}s] {word.word}")
```

Output: `segment.words` contains `Word(start, end, word, probability)` entries.

Use the related CLI shim:

```bash
whisper-ctranslate2 audio.mp3 --model medium --task transcribe --compute_type int8 --vad_filter True
```

Output: CLI transcription using the separate `whisper-ctranslate2` package and faster-whisper backend.

## Error handling

| Symptom | Likely cause | Fix |
|---|---|---|
| `Requested float16 compute type, but the target device or backend do not support efficient float16 computation.` | `compute_type="float16"` on CPU or GPU/backend without efficient FP16 support. | Use `compute_type="float32"` or `"int8"` on CPU; use CUDA GPU with sufficient compute capability for FP16; consider `compute_type="auto"`. |
| `[ctranslate2] [warning] The compute type inferred from the saved model is float16, but the target device or backend do not support efficient float16 computation. The model weights have been automatically converted to use the float32 compute type instead.` | Runtime fallback because saved FP16 model is not efficient on target hardware. | Explicitly set a supported `compute_type` (`float32`, `int8`, or `auto`) for the target device. |
| `RuntimeError: Library libcublas.so.12 is not found or cannot be loaded` | CUDA 12 cuBLAS libraries are missing or not visible to the loader. | Install CUDA/cuBLAS for the CTranslate2 version in use; on Linux install `nvidia-cublas-cu12` and set `LD_LIBRARY_PATH` before launching Python, or use a CUDA Docker image. |
| `cudnn ops64_9.dll is not found` | Windows cuDNN DLL mismatch, commonly conflicting `torch` and `ctranslate2` CUDA/cuDNN versions. | Align CUDA/cuDNN/Torch/CTranslate2 versions; known working combinations include `torch>=2.4.0` with `ctranslate2>=4.5.0`, or pin `ctranslate2<=4.4.0` for `torch` CUDA 12.1-era stacks. |
| `Could not load library cudnn_ops_infer64_8.dll. Error code 126` | Windows cuDNN 8 DLL missing from library path. | Add the cuDNN `bin` directory to `PATH`, restart shell, or use versions matching installed CTranslate2. |
| `RuntimeError: CUDA failed with error CUDA driver version is insufficient for CUDA runtime version` | NVIDIA driver is older than the CUDA runtime required by installed libraries. | Upgrade NVIDIA driver or install CTranslate2/CUDA libraries matching the driver. |
| `RuntimeError: CUDA failed with error initialization error` | CUDA initialized in parent process then reinitialized in a forked subprocess. | Use multiprocessing `spawn`, avoid CUDA calls before forking, or instantiate `WhisperModel(device="cuda")` only inside the child process. |
| `CUDA failed with error out of memory` | Model, batch size, or compute type exceeds available VRAM. | Use smaller/distil/turbo model, reduce `batch_size`, use `int8_float16`/`int8`, unload other GPU users, or run CPU INT8. |
| `Applying the VAD filter requires the onnxruntime package` | `onnxruntime` is not installed/importable while VAD is requested. | Reinstall package dependencies: `python -m pip install --upgrade --force-reinstall faster-whisper onnxruntime`. |
| `No clip timestamps found. Set 'vad_filter' to True or provide 'clip_timestamps'.` | Batched path has no VAD-derived speech clips and no explicit `clip_timestamps`. | Set `vad_filter=True` or provide `clip_timestamps=[{"start": ..., "end": ...}]`. |
| `'%s' is not a valid task (accepted tasks: transcribe, translate)` | Invalid `task` passed to multilingual tokenizer. | Use `task="transcribe"` or `task="translate"`. |
| `'%s' is not a valid language code (accepted language codes: %s)` | Unsupported `language` code. | Use one of the codes listed in `Tokenizer` surface or omit `language` for detection. |
| `Invalid model size '%s', expected one of: %s` | `model_size_or_path` / `size_or_id` is not a built-in alias and not a Hugging Face repo ID containing `/`. | Use `available_models()`, a local converted model path, or a valid Hugging Face repo ID like `Systran/faster-whisper-large-v3`. |
| `Either audio or features must be provided.` | `detect_language()` called without `audio` or `features`. | Pass a 1D 16 kHz waveform via `audio=` or Mel features via `features=`. |
| `The length of the prompt is ..., and the max_new_tokens ... exceeds the max_length of the Whisper model: 448.` | `initial_prompt`, `hotwords`, `prefix`, and/or `max_new_tokens` exceed model token limit. | Shorten prompt/hotwords/prefix or reduce `max_new_tokens`. |
| `stft requires the return_complex parameter for real inputs.` | `FeatureExtractor.stft()` called directly without `return_complex` for real-valued input. | Call `FeatureExtractor.__call__()` instead, or pass `return_complex=True`/`False` explicitly. |
| `Input should be a 1D array` | `SileroVADModel.__call__()` received multi-dimensional audio. | Pass mono 1D waveform; use `decode_audio(..., split_stereo=False)` or select one channel. |
| `Input size should be a multiple of num_samples` | Direct VAD model call received unpadded length. | Use `get_speech_timestamps()` instead of direct model call; it pads audio internally. |

## Traps

_Append-only. Date-stamped. Filled by the operator via the `/lesson`
slash command when something bites._

## Lessons

_Append-only. Date-stamped. Filled by the operator via the `/lesson`
slash command for behaviors learned that aren't in upstream docs._
