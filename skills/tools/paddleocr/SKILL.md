---
name: tool-paddleocr
description: Load when working with paddleocr, OCR pipelines, PP-OCRv5, PaddleOCR-VL, document parsing, model inference, or PaddleX serving. Covers CLI/API surface, setup, errors, and lessons.
triggers:
  bash:
    - paddleocr
    - python -m paddleocr
    - from paddleocr
    - PaddleOCRVL
    - PPStructureV3
    - pp_structurev3
    - doc_parser
    - genai_server
    - PaddleOCR-VL
---

# paddleocr

## What it is

PaddleOCR is a Python package and CLI for optical character recognition, document parsing, table/layout extraction, and OCR-oriented vision-language inference on images and PDFs. Reach for it when an agent must convert document images or PDFs into text, JSON, Markdown, Word, HTML, XLSX, coordinates, or service responses. It is built on PaddlePaddle and PaddleX; common alternatives are Tesseract, EasyOCR, DocTR, and OCR-oriented VLM/document parsers.

## Capability surface

### Entry points

```bash
paddleocr ocr -i INPUT [OPTIONS]
paddleocr pp_structurev3 -i INPUT [OPTIONS]
paddleocr doc_parser -i INPUT [OPTIONS]
paddleocr genai_server [OPTIONS]
paddlex --install serving
paddlex --serve --pipeline PIPELINE [OPTIONS]
paddlex --get_pipeline_config PIPELINE
```

### `paddleocr ocr`

General OCR pipeline. Default/current OCR family is PP-OCRv5; older OCR versions remain selectable.

```bash
paddleocr ocr -i ./image.png --save_path ./output --lang en --device gpu:0
paddleocr ocr -i ./doc.pdf --ocr_version PP-OCRv4 --engine transformers
```

| Flag / parameter | Accepted values / type | Purpose |
|---|---|---|
| `-i`, `--input`, `input` | `str`; image path, PDF path, URL, or local directory | Data to predict. |
| `--save_path`, `save_path` | `str` | Directory/file path for local result artifacts. If unset, results are printed only. |
| `--doc_orientation_classify_model_name` | `str` | Document orientation classifier model name. |
| `--doc_orientation_classify_model_dir` | `str` | Local document orientation classifier model directory. |
| `--doc_unwarping_model_name` | `str` | Document image unwarping model name. |
| `--doc_unwarping_model_dir` | `str` | Local document image unwarping model directory. |
| `--text_detection_model_name` | `str` | Text detection model name. |
| `--text_detection_model_dir` | `str` | Local text detection model directory. |
| `--textline_orientation_model_name` | `str` | Text-line orientation classifier model name. |
| `--textline_orientation_model_dir` | `str` | Local text-line orientation classifier model directory. |
| `--textline_orientation_batch_size` | `int` | Batch size for text-line orientation classification. |
| `--text_recognition_model_name` | `str` | Text recognition model name. |
| `--text_recognition_model_dir` | `str` | Local text recognition model directory. |
| `--text_recognition_batch_size` | `int` | Batch size for text recognition. |
| `--use_doc_orientation_classify` | `bool` | Enable/disable document orientation classification. |
| `--use_doc_unwarping` | `bool` | Enable/disable document image unwarping. |
| `--use_textline_orientation` | `bool` | Enable/disable text-line orientation classification. |
| `--text_det_limit_side_len` | `int > 0`; default commonly `960` | Side-length bound before text detection. |
| `--text_det_limit_type` | `min`, `max`; default commonly `max` | Bound shortest side (`min`) or longest side (`max`). |
| `--text_det_thresh` | `float > 0`; default commonly `0.3` | Pixel threshold for detection probability map. |
| `--text_det_box_thresh` | `float > 0`; default commonly `0.6` | Box threshold for detected text boxes. |
| `--text_det_unclip_ratio` | `float > 0`; default commonly `2.0` | Text box expansion ratio. |
| `--text_det_input_shape` | shape string / model-dependent | Text detector input shape. |
| `--text_rec_score_thresh` | `float > 0`; default commonly `0.0` | Drop recognition results below this score. |
| `--return_word_box` | `bool` | Return word-level boxes when supported. |
| `--text_rec_input_shape` | shape string / model-dependent | Text recognizer input shape. |
| `--lang` | language code | Language/model selection. Examples: `ch`, `en`, `japan`, `korean`, `fr`, `german`. |
| `--ocr_version` | `PP-OCRv5`, `PP-OCRv4`, `PP-OCRv3` | Select OCR model/version family. |
| `--device` | `cpu`, `gpu`, `gpu:0`, `npu:0`, `xpu:0`, `mlu:0`, `dcu:0`, `metax_gpu:0`, `iluvatar_gpu:0` | Inference device. GPU 0 preferred when available; CPU otherwise. |
| `--engine` | `None`, `paddle`, `paddle_static`, `paddle_dynamic`, `transformers` | Inference engine. `None` preserves default behavior. |
| `--enable_hpi` | `bool` | Enable high-performance inference. |
| `--use_tensorrt` | `bool` | Enable TensorRT subgraph acceleration when model/runtime supports it. |
| `--precision` | `fp32`, `fp16` | Computation precision. |
| `--enable_mkldnn` | `bool` | Enable MKL-DNN acceleration where supported. |
| `--mkldnn_cache_capacity` | `int` | MKL-DNN cache capacity. |
| `--cpu_threads` | `int` | CPU inference thread count. |
| `--paddlex_config` | path | Load a PaddleX pipeline YAML/config. |

Deprecated / 2.x compatibility flags:

| Legacy flag | Replacement / note |
|---|---|
| `--det_model_dir` | Use `--text_detection_model_dir`. |
| `--det_limit_side_len` | Use `--text_det_limit_side_len`. |
| `--det_limit_type` | Use `--text_det_limit_type`. |
| `--det_db_thresh` | Use `--text_det_thresh`. |
| `--det_db_box_thresh` | Use `--text_det_box_thresh`. |
| `--det_db_unclip_ratio` | Use `--text_det_unclip_ratio`. |
| `--rec_model_dir` | Use `--text_recognition_model_dir`. |
| `--rec_batch_num` | Use `--text_recognition_batch_size`. |
| `--use_angle_cls` | Use `--use_textline_orientation` where applicable. |
| `--cls_model_dir` | Use `--textline_orientation_model_dir` where applicable. |
| `--cls_batch_num` | Use `--textline_orientation_batch_size` where applicable. |

### `PaddleOCR` Python API

```python
from paddleocr import PaddleOCR

ocr = PaddleOCR(
    lang="en",
    ocr_version="PP-OCRv5",
    device="gpu:0",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
)
result = ocr.predict("./image.png")
for res in result:
    res.print()
    res.save_to_img("output")
    res.save_to_json("output")
```

Constructor parameters mirror the `paddleocr ocr` CLI parameters:

| Parameter | Type / values | Purpose |
|---|---|---|
| `doc_orientation_classify_model_name` | `str | None` | Document orientation classifier model. |
| `doc_orientation_classify_model_dir` | `str | None` | Local document orientation classifier directory. |
| `doc_unwarping_model_name` | `str | None` | Document unwarping model. |
| `doc_unwarping_model_dir` | `str | None` | Local document unwarping directory. |
| `text_detection_model_name` | `str | None` | Text detection model. |
| `text_detection_model_dir` | `str | None` | Local text detection directory. |
| `textline_orientation_model_name` | `str | None` | Text-line orientation model. |
| `textline_orientation_model_dir` | `str | None` | Local text-line orientation directory. |
| `textline_orientation_batch_size` | `int | None` | Text-line orientation batch size. |
| `text_recognition_model_name` | `str | None` | Text recognition model. |
| `text_recognition_model_dir` | `str | None` | Local text recognition directory. |
| `text_recognition_batch_size` | `int | None` | Text recognition batch size. |
| `use_doc_orientation_classify` | `bool | None` | Enable/disable orientation classifier. |
| `use_doc_unwarping` | `bool | None` | Enable/disable unwarping. |
| `use_textline_orientation` | `bool | None` | Enable/disable text-line orientation. |
| `text_det_limit_side_len` | `int | None` | Text detector side-length bound. |
| `text_det_limit_type` | `str | None` | `min` or `max`. |
| `text_det_thresh` | `float | None` | Detection map threshold. |
| `text_det_box_thresh` | `float | None` | Detection box threshold. |
| `text_det_unclip_ratio` | `float | None` | Box expansion ratio. |
| `text_rec_score_thresh` | `float | None` | Recognition score threshold. |
| `return_word_box` | `bool | None` | Return word boxes when supported. |
| `lang` | `str | None` | Language code. |
| `ocr_version` | `PP-OCRv5`, `PP-OCRv4`, `PP-OCRv3` | OCR family. |
| `device` | device string | Inference device. |
| `engine` | `None`, `paddle`, `paddle_static`, `paddle_dynamic`, `transformers` | Inference engine. |
| `enable_hpi` | `bool | None` | High-performance inference toggle. |
| `use_tensorrt` | `bool` | TensorRT toggle. |
| `precision` | `str` | `fp32` or `fp16`. |
| `enable_mkldnn` | `bool` | MKL-DNN toggle. |
| `mkldnn_cache_capacity` | `int` | MKL-DNN cache size. |
| `cpu_threads` | `int` | CPU thread count. |
| `paddlex_config` | `str | dict | None` | PaddleX pipeline config path/dict. |

Prediction methods:

| Method | Purpose |
|---|---|
| `predict(input, **overrides)` | Eager prediction over image/PDF/URL/directory input. |
| `predict_iter(input, **overrides)` | Iterator/lazy prediction for streaming large inputs. |
| `export_paddlex_config_to_yaml(path)` | Export current pipeline configuration to YAML. |
| `close()` | Release resources when available on the object. |

OCR result methods and attributes:

| Surface | Meaning |
|---|---|
| `res.print()` | Print structured result. |
| `res.save_to_json(save_path)` | Save JSON result. |
| `res.save_to_img(save_path)` | Save visualization image. |
| `res.json` | JSON-serializable result structure. |
| `res.img` | Visualization image object(s). |
| `input_path`, `page_index` | Input identity and PDF page index. |
| `model_settings` | Pipeline feature toggles used for prediction. |
| `doc_preprocessor_res`, `angle` | Document preprocessing/orientation output. |
| `dt_polys`, `dt_scores` | Text detection polygons and scores. |
| `text_det_params` | Detection thresholds and limit settings. |
| `rec_texts`, `rec_scores`, `rec_polys`, `rec_boxes` | Recognition strings, confidence scores, polygons, boxes. |
| `textline_orientation_angles` | Text-line orientation output. |

### `paddleocr pp_structurev3`

PP-StructureV3 document structure parsing: layout detection, OCR, tables, formulas, chart parsing, seal recognition, Markdown/Word export.

```bash
paddleocr pp_structurev3 -i ./doc.pdf --save_path ./output
paddleocr pp_structurev3 -i ./doc.png --use_doc_orientation_classify True --device gpu
paddleocr pp_structurev3 --paddlex_config PP-StructureV3.yaml -i ./doc.png
```

| Flag / parameter | Type / values | Purpose |
|---|---|---|
| `-i`, `--input`, `input` | `str` | Image/PDF path, URL, or image directory. Directories with PDFs require file paths. |
| `--save_path`, `save_path` | `str` | Save structured results locally. |
| `--layout_detection_model_name` | `str` | Layout detection model name. |
| `--layout_detection_model_dir` | `str` | Local layout detection model directory. |
| `--layout_threshold` | `float` `0..1`, `dict`, `None` | Layout detection score threshold. |
| `--layout_nms` | `bool` | Non-maximum suppression in layout detection. |
| `--layout_unclip_ratio` | `float > 0`, tuple, or dict | Expand layout boxes. |
| `--layout_merge_bboxes_mode` | `large`, `small`, `union`, or dict | Handling of overlapping layout boxes. |
| `--chart_recognition_model_name` | `str` | Chart parsing model name. |
| `--chart_recognition_model_dir` | `str` | Local chart parsing model directory. |
| `--chart_recognition_batch_size` | `int` | Chart parsing batch size. |
| `--region_detection_model_name` | `str` | Region detection model for document layout sub-modules. |
| `--region_detection_model_dir` | `str` | Local region detection model directory. |
| `--doc_orientation_classify_model_name` | `str` | Document orientation classifier model name. |
| `--doc_orientation_classify_model_dir` | `str` | Local document orientation classifier directory. |
| `--doc_unwarping_model_name` | `str` | Document image unwarping model name. |
| `--doc_unwarping_model_dir` | `str` | Local document unwarping directory. |
| `--text_detection_model_name` | `str` | OCR text detection model name. |
| `--text_detection_model_dir` | `str` | Local OCR text detection directory. |
| `--text_det_limit_side_len` | `int > 0`; default commonly `960` | OCR text detector side-length limit. |
| `--text_det_limit_type` | `min`, `max`; default commonly `max` | OCR detector side-length limit type. |
| `--text_det_thresh` | `float > 0`; default commonly `0.3` | OCR detector pixel threshold. |
| `--text_det_box_thresh` | `float > 0`; default commonly `0.6` | OCR detector box threshold. |
| `--text_det_unclip_ratio` | `float > 0`; default commonly `2.0` | OCR box expansion ratio. |
| `--textline_orientation_model_name` | `str` | Text-line orientation classifier model. |
| `--textline_orientation_model_dir` | `str` | Local text-line orientation directory. |
| `--textline_orientation_batch_size` | `int` | Text-line orientation batch size. |
| `--text_recognition_model_name` | `str` | OCR recognizer model name. Use `en_PP-OCRv4_mobile_rec` for English-only PP-StructureV3 scenarios. |
| `--text_recognition_model_dir` | `str` | Local OCR recognizer directory. |
| `--text_recognition_batch_size` | `int` | OCR recognizer batch size. |
| `--text_rec_score_thresh` | `float > 0`; default commonly `0.0` | OCR recognition score filter. |
| `--table_classification_model_name` | `str` | Table classification model. |
| `--table_classification_model_dir` | `str` | Local table classification directory. |
| `--wired_table_structure_recognition_model_name` | `str` | Wired-table structure model. |
| `--wired_table_structure_recognition_model_dir` | `str` | Local wired-table structure directory. |
| `--wireless_table_structure_recognition_model_name` | `str` | Wireless-table structure model. |
| `--wireless_table_structure_recognition_model_dir` | `str` | Local wireless-table structure directory. |
| `--wired_table_cells_detection_model_name` | `str` | Wired-table cell detection model. |
| `--wired_table_cells_detection_model_dir` | `str` | Local wired-table cell detection directory. |
| `--wireless_table_cells_detection_model_name` | `str` | Wireless-table cell detection model. |
| `--wireless_table_cells_detection_model_dir` | `str` | Local wireless-table cell detection directory. |
| `--table_orientation_classify_model_name` | `str` | Table orientation classifier model. |
| `--table_orientation_classify_model_dir` | `str` | Local table orientation classifier directory. |
| `--seal_text_detection_model_name` | `str` | Seal text detection model. |
| `--seal_text_detection_model_dir` | `str` | Local seal text detector directory. |
| `--seal_det_limit_side_len` | `int > 0`; default commonly `736` | Seal detector side-length limit. |
| `--seal_det_limit_type` | `min`, `max`; default commonly `min` | Seal detector limit type. |
| `--seal_det_thresh` | `float > 0`; default commonly `0.2` | Seal detector pixel threshold. |
| `--seal_det_box_thresh` | `float > 0`; default commonly `0.6` | Seal detector box threshold. |
| `--seal_det_unclip_ratio` | `float > 0`; default commonly `0.5` | Seal detector box expansion ratio. |
| `--seal_text_recognition_model_name` | `str` | Seal text recognition model. |
| `--seal_text_recognition_model_dir` | `str` | Local seal text recognition directory. |
| `--seal_text_recognition_batch_size` | `int` | Seal text recognition batch size. |
| `--seal_rec_score_thresh` | `float > 0`; default commonly `0.0` | Seal recognition score filter. |
| `--formula_recognition_model_name` | `str` | Formula recognition model. |
| `--formula_recognition_model_dir` | `str` | Local formula recognition directory. |
| `--formula_recognition_batch_size` | `int` | Formula recognition batch size. |
| `--use_doc_orientation_classify` | `bool`; default `False` | Enable document orientation classifier. |
| `--use_doc_unwarping` | `bool`; default `False` | Enable document unwarping. |
| `--use_textline_orientation` | `bool`; default `False` | Enable text-line orientation classification. |
| `--use_seal_recognition` | `bool`; default `False` | Enable seal text recognition subpipeline. |
| `--use_table_recognition` | `bool`; default `True` | Enable table recognition subpipeline. |
| `--use_formula_recognition` | `bool`; default `True` | Enable formula recognition subpipeline. |
| `--use_chart_recognition` | `bool`; default `False` | Enable chart parsing. |
| `--use_region_detection` | `bool`; default `True` | Enable document region detection. |
| `--format_block_content` | `bool`; default `False` | Format block content as Markdown. |
| `--markdown_ignore_labels` | list/string | Layout labels omitted from Markdown; default includes `number`, `footnote`, `header`, `header_image`, `footer`, `footer_image`, `aside_text`. |
| `--device` | device string | CPU/GPU/NPU/XPU/MLU/DCU/MetaX/Iluvatar. |
| `--engine` | `None`, `paddle`, `paddle_static`, `paddle_dynamic`, `transformers` | Inference engine. |
| `--enable_hpi` | `bool` | High-performance inference toggle. |
| `--use_tensorrt` | `bool` | TensorRT toggle. |
| `--precision` | `fp32`, `fp16` | Computation precision. |
| `--enable_mkldnn` | `bool` | MKL-DNN toggle. |
| `--mkldnn_cache_capacity` | `int` | MKL-DNN cache capacity. |
| `--cpu_threads` | `int` | CPU inference threads. |
| `--paddlex_config` | path | Load PaddleX pipeline config. |

Python API:

```python
from paddleocr import PPStructureV3

pipeline = PPStructureV3(
    lang="en",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    device="gpu:0",
)
output = pipeline.predict("./doc.pdf")
for res in output:
    res.print()
    res.save_to_json(save_path="output")
    res.save_to_markdown(save_path="output")
    res.save_to_word(save_path="output")
```

Additional `PPStructureV3` surface:

| Method / attribute | Purpose |
|---|---|
| `predict(input, **overrides)` | Run document parsing. |
| `concatenate_markdown_pages(markdown_list)` | Merge PDF page Markdown into one document. |
| `export_paddlex_config_to_yaml(path)` | Export default/full config. |
| `res.save_to_markdown(save_path)` | Save Markdown output and images. |
| `res.save_to_word(save_path)` | Save Word export. |
| `res.json`, `res.markdown`, `res.img` | Structured result views. |

### `paddleocr doc_parser`

PaddleOCR-VL document parser. Uses local inference engines or VLM-service-backed inference for document parsing.

```bash
paddleocr doc_parser -i ./doc.pdf --save_path ./output --device gpu:0
paddleocr doc_parser -i ./doc.pdf --engine transformers --use_layout_detection True
```

| Flag / parameter | Accepted values / type | Purpose |
|---|---|---|
| `-i`, `--input`, `input` | `str` | Image/PDF path, URL, or directory. |
| `--save_path`, `save_path` | `str` | Local result output path. |
| `--pipeline_version` | `str` | PaddleOCR-VL pipeline version. |
| `--layout_detection_model_name` | `str` | Layout detection model name. |
| `--layout_detection_model_dir` | `str` | Local layout detection model directory. |
| `--layout_threshold` | `float`, `dict`, `None` | Layout score threshold. |
| `--layout_nms` | `bool` | Layout NMS toggle. |
| `--layout_unclip_ratio` | `float`, tuple, dict, `None` | Layout box expansion. |
| `--layout_merge_bboxes_mode` | `large`, `small`, `union`, dict, `None` | Layout overlap handling. |
| `--vl_rec_model_name` | `str` | VLM recognition model name; e.g. PaddleOCR-VL family. |
| `--vl_rec_model_dir` | `str` | Local VLM model directory. |
| `--vl_rec_backend` | backend string | Local/service backend for VLM recognition. |
| `--vl_rec_server_url` | URL | VLM inference server URL. |
| `--vl_rec_max_concurrency` | `int` | Max concurrent VLM calls. |
| `--vl_rec_api_model_name` | `str` | External/API model name. |
| `--vl_rec_api_key` | secret name/value source | External/API VLM key. Do not inline real keys in commands. |
| `--doc_orientation_classify_model_name` | `str` | Orientation classifier model. |
| `--doc_orientation_classify_model_dir` | `str` | Local orientation classifier directory. |
| `--doc_unwarping_model_name` | `str` | Document unwarping model. |
| `--doc_unwarping_model_dir` | `str` | Local document unwarping directory. |
| `--use_doc_orientation_classify` | `bool` | Enable orientation classifier. |
| `--use_doc_unwarping` | `bool` | Enable document unwarping. |
| `--use_layout_detection` | `bool` | Enable layout detection. |
| `--use_chart_recognition` | `bool` | Enable chart recognition. |
| `--use_seal_recognition` | `bool` | Enable seal recognition. |
| `--use_ocr_for_image_block` | `bool` | Apply OCR to image blocks. |
| `--format_block_content` | `bool` | Format block content. |
| `--merge_layout_blocks` | `bool` | Merge layout blocks. |
| `--markdown_ignore_labels` | list/string | Layout labels omitted from Markdown. |
| `--layout_shape_mode` | `rect`, `quad`, `poly`, `auto` | Output shape type for layout/localization. |
| `--use_queues` | `bool` | Queue mode for pipeline service/execution. |
| `--prompt_label` | `str` | VLM prompt label. |
| `--repetition_penalty` | `float` | VLM decoding repetition penalty. |
| `--temperature` | `float` | VLM decoding temperature. |
| `--top_p` | `float` | Nucleus sampling top-p. |
| `--min_pixels` | `int` | Minimum image pixels for VLM preprocessing. |
| `--max_pixels` | `int` | Maximum image pixels for VLM preprocessing. |
| `--device` | device string | CPU/GPU/NPU/XPU/MLU/DCU/MetaX/Iluvatar/etc. |
| `--engine` | `None`, `paddle`, `paddle_static`, `paddle_dynamic`, `transformers` | Inference engine. |
| `--enable_hpi` | `bool` | High-performance inference toggle. |
| `--use_tensorrt` | `bool` | TensorRT toggle. |
| `--precision` | `fp32`, `fp16` | Computation precision. |
| `--enable_mkldnn` | `bool` | MKL-DNN toggle. |
| `--mkldnn_cache_capacity` | `int` | MKL-DNN cache capacity. |
| `--cpu_threads` | `int` | CPU inference threads. |
| `--paddlex_config` | path | Load PaddleX pipeline config. |

### `PaddleOCRVL` Python API

```python
from paddleocr import PaddleOCRVL

pipeline = PaddleOCRVL(
    device="gpu:0",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_layout_detection=True,
)
output = pipeline.predict("./doc.pdf")
for res in output:
    res.print()
    res.save_to_json(save_path="output")
    res.save_to_markdown(save_path="output")
    res.save_to_html(save_path="output")
    res.save_to_xlsx(save_path="output")
    res.save_to_word(save_path="output")
```

Constructor / prediction parameters include the `doc_parser` CLI parameters plus VLM-specific extra args:

| Surface | Purpose |
|---|---|
| `PaddleOCRVL(**kwargs)` | Instantiate PaddleOCR-VL document parser. |
| `predict(input, **overrides)` | Parse input document/image. |
| `restructure_pages(pages, merge_tables=True, relevel_titles=True, concatenate_pages=True)` | Merge/restructure multi-page results. |
| `vlm_extra_args.ocr_min_pixels`, `ocr_max_pixels` | Pixel bounds for OCR-oriented VLM regions. |
| `vlm_extra_args.table_min_pixels`, `table_max_pixels` | Pixel bounds for table regions. |
| `vlm_extra_args.chart_min_pixels`, `chart_max_pixels` | Pixel bounds for chart regions. |
| `vlm_extra_args.formula_min_pixels`, `formula_max_pixels` | Pixel bounds for formula regions. |
| `vlm_extra_args.seal_min_pixels`, `seal_max_pixels` | Pixel bounds for seal regions. |
| `res.print()` | Print result. |
| `res.save_to_json(save_path)` | JSON export. |
| `res.save_to_img(save_path)` | Visualization export. |
| `res.save_to_markdown(save_path)` | Markdown export. |
| `res.save_to_html(save_path)` | HTML export. |
| `res.save_to_xlsx(save_path)` | XLSX export. |
| `res.save_to_word(save_path)` | Word export. |

### `paddleocr genai_server`

VLM backend server for PaddleOCR-VL. This server handles the VLM stage; it is not the same as the full end-to-end PaddleOCR-VL pipeline service.

```bash
paddleocr genai_server \
  --model_name PaddleOCR-VL-1.5-0.9B \
  --host 0.0.0.0 \
  --port 8118 \
  --backend vllm \
  --backend_config ./vlm_config.yaml
```

| Flag | Type / values | Purpose |
|---|---|---|
| `--model_name` | model name | VLM model to serve. |
| `--host` | host/IP | Bind host. |
| `--port` | integer | Bind port. |
| `--backend` | `vllm`, `fastdeploy`, backend-supported values | VLM inference backend. |
| `--backend_config` | YAML path | Backend-specific config. |

### PaddleX service deployment

```bash
paddlex --install serving
paddlex --serve --pipeline PaddleOCR-VL --device gpu:0 --host 0.0.0.0 --port 8080
paddlex --get_pipeline_config PaddleOCR-VL
```

| CLI flag | Purpose |
|---|---|
| `--pipeline` | Pipeline name; e.g. `PaddleOCR-VL`, `OCR`, `PP-StructureV3`. |
| `--device` | Inference device. |
| `--host` | Service host. |
| `--port` | Service port. |
| `--use_hpip` | High-performance inference plugin toggle. |
| `--hpi_config` | High-performance inference config path. |
| `--get_pipeline_config` | Export a pipeline config for editing. |

Service API: General OCR.

| Operation | Request / response |
|---|---|
| `POST /ocr` | Request fields: `file`, `fileType`, `useDocOrientationClassify`, `useDocUnwarping`, `useTextlineOrientation`, `textDetLimitSideLen`, `textDetLimitType`, `textDetThresh`, `textDetBoxThresh`, `textDetUnclipRatio`, `textRecScoreThresh`, `visualize`. Response fields: `logId`, `errorCode`, `errorMsg`, `result`. |

Service API: PP-StructureV3 / layout parsing.

| Operation | Request / response |
|---|---|
| `POST /layout-parsing` | Request fields: `file`, `fileType`, `useDocOrientationClassify`, `useDocUnwarping`, `useTextlineOrientation`, detection/recognition thresholds, output/visualization controls. Response fields: `logId`, `errorCode`, `errorMsg`, `result`. Successful `result` includes `layoutParsingResults` and `dataInfo`; each parsed result includes `prunedResult`, `markdown`, `outputImages`, `inputImage`, and optional `exports`. |

Pipeline config controls seen in PaddleOCR-VL serving configs:

| Config key | Purpose |
|---|---|
| `genai_config.backend` | VLM backend selection. |
| `genai_config.server_url` | VLM backend/service URL. |
| `Serving.visualize` | Default image-return behavior. |
| `Serving.extra.max_num_input_imgs` | Page/image limit for service requests; set `null` to remove default page cap. |
| `use_doc_preprocessor` | Enable full document preprocessing where service/client asks for it. |
| `BOS.ak`, `BOS.sk` | Object storage access key / secret key names. Never inline real secrets. |

### Model/module inventory

Pipelines exposed in current 3.x docs:

| Pipeline | Role |
|---|---|
| `OCR` / `paddleocr ocr` | Text detection + text recognition for images/PDFs. |
| `PP-StructureV3` / `paddleocr pp_structurev3` | Layout/table/formula/chart/seal/document-structure parsing. |
| `PP-ChatOCRv4` | Key information extraction / document Q&A workflow. |
| `PaddleOCR-VL` / `paddleocr doc_parser` | VLM-based document parsing. |
| Formula recognition pipeline | Formula extraction/recognition. |
| Document image preprocessing pipeline | Orientation classification, unwarping, image preparation. |
| Document understanding pipeline | Document-level understanding. |
| Seal text recognition pipeline | Seal/stamp text detection + recognition. |
| General table recognition v2 pipeline | Table structure and content recognition. |
| PP-DocTranslation pipeline | Document translation workflow. |

Module list exposed in current 3.x docs:

| Module | Role |
|---|---|
| Document image orientation classification | Page/image orientation. |
| Document visual language model | PaddleOCR-VL core VLM module. |
| Formula recognition | Formula recognition. |
| Layout detection | Detect titles/text/images/tables/formulas/layout blocks. |
| Seal text detection | Detect seal/stamp text regions. |
| Table cell detection | Detect table cells. |
| Table classification | Classify table style/type. |
| Table structure recognition | Recover table structure. |
| Text detection | Locate text regions. |
| Text image rectification | Correct text image distortion. |
| Text-line orientation classification | Determine line direction. |
| Text recognition | Recognize text content from cropped/located regions. |

### Language codes

Common supported `lang` codes listed by the official docs include:

`abq`, `af`, `ang`, `ar`, `ava`, `az`, `be`, `bg`, `bgc`, `bh`, `bho`, `bs`, `ch`, `che`, `chinese_cht`, `cs`, `cy`, `da`, `dar`, `de`/`german`, `en`, `es`, `et`, `fa`, `fr`/`french`, `ga`, `gom`, `hi`, `hr`, `hu`, `id`, `inh`, `is`, `it`, `japan`, `ka`, `kbd`, `korean`, `ku`, `la`, `lbe`, `lez`, `lt`, `lv`, `mah`, `mai`, `mi`, `mn`, `mr`, `ms`, `mt`, `ne`, `new`, `nl`, `no`, `oc`, `pi`, `pl`, `pt`, `ro`, `rs_cyrillic`, `rs_latin`, `ru`, `sa`, `sck`, `sk`, `sl`, `sq`, `sv`, `sw`, `tab`, `ta`, `te`, `tl`, `tr`, `ug`, `uk`, `ur`, `uz`, `vi`.

## Setup & auth

Install in an isolated environment:

```bash
python -m venv .venv
. .venv/bin/activate
python -m pip install -U pip
```

Install PaddlePaddle first. Select CPU/GPU package and CUDA index for the machine:

```bash
# CPU
python -m pip install paddlepaddle==3.3.0 -i https://www.paddlepaddle.org.cn/packages/stable/cpu/

# GPU examples; select exactly one matching runtime/driver constraints.
python -m pip install paddlepaddle-gpu==3.3.0 -i https://www.paddlepaddle.org.cn/packages/stable/cu118/
python -m pip install paddlepaddle-gpu==3.3.0 -i https://www.paddlepaddle.org.cn/packages/stable/cu126/
python -m pip install paddlepaddle-gpu==3.3.0 -i https://www.paddlepaddle.org.cn/packages/stable/cu129/
python -m pip install paddlepaddle-gpu==3.3.0 -i https://www.paddlepaddle.org.cn/packages/stable/cu130/
```

Install PaddleOCR:

```bash
python -m pip install paddleocr
python -m pip install -U "paddleocr[all]"
python -m pip install -U "paddleocr[doc-parser]"
```

Verify:

```bash
python - <<'PY'
import paddle
import paddleocr
paddle.utils.run_check()
print("paddle", paddle.__version__)
print("paddleocr", paddleocr.__version__)
PY
```

Runtime notes:

| Area | Notes |
|---|---|
| Python | PaddleOCR-VL docs recommend Python 3.9 through 3.13. |
| GPU | Install the PaddlePaddle wheel matching the machine GPU/driver/CUDA constraints. |
| Windows | PaddlePaddle/PaddleOCR can run on Windows, but vLLM/SGLang/FastDeploy VLM backends are not natively supported in Windows environments; use supported Docker/Linux paths. |
| Optimized VLM engines | Keep `transformers`, `vllm`, `sglang`, and `fastdeploy` stacks isolated when their dependency constraints conflict. |
| TensorRT | Only accelerates when the model and PaddlePaddle/TensorRT versions are compatible. |
| Models | Model directories left unset trigger official model downloads. V3 exact model cache root: (Could not locate authoritative source. Needs hands-on verification.) Legacy 2.x whl docs used `~/.paddleocr/det`, `~/.paddleocr/rec`, and `~/.paddleocr/cls`. |
| Config | Use `export_paddlex_config_to_yaml(...)`, `--paddlex_config`, or `paddlex --get_pipeline_config PIPELINE` for reproducible deployment configs. |
| Secrets | Local OCR requires no credentials. `vl_rec_api_key` comes from the selected VLM/API provider. BOS `ak` and `sk` come from the object-storage provider. Do not inline real secrets. |

## Common workflows

General OCR from CLI:

```bash
paddleocr ocr -i ./receipt.png --save_path ./ocr-out --lang en --device gpu:0
```

Prints structured OCR output and writes visualization/JSON artifacts under `./ocr-out`.

General OCR from Python:

```python
from paddleocr import PaddleOCR

ocr = PaddleOCR(lang="en", device="gpu:0")
for res in ocr.predict("./receipt.png"):
    res.print()
    res.save_to_img("ocr-out")
    res.save_to_json("ocr-out")
```

Returns per-image/per-page structured OCR results, saved as JSON and visualization images.

Parse a PDF to Markdown/Word with PP-StructureV3:

```bash
paddleocr pp_structurev3 -i ./paper.pdf --save_path ./structure-out --device gpu:0
```

Writes structured parsing artifacts, including Markdown and document-layout information where enabled.

Use English recognition model for English-heavy structure parsing:

```bash
paddleocr pp_structurev3 \
  -i ./english-paper.pdf \
  --text_recognition_model_name en_PP-OCRv4_mobile_rec \
  --save_path ./structure-out
```

Improves English-only recognition versus the default Chinese-English recognition model.

Parse with PaddleOCR-VL:

```bash
paddleocr doc_parser -i ./complex-doc.pdf --save_path ./vl-out --device gpu:0
```

Writes PaddleOCR-VL document parsing outputs, including Markdown/JSON-style structures.

Serve a full PaddleOCR-VL pipeline:

```bash
paddlex --install serving
paddlex --serve --pipeline PaddleOCR-VL --device gpu:0 --host 0.0.0.0 --port 8080
```

Starts a service exposing layout parsing endpoints such as `POST /layout-parsing`.

Run a VLM backend server for PaddleOCR-VL:

```bash
paddleocr genai_server \
  --model_name PaddleOCR-VL-1.5-0.9B \
  --host 0.0.0.0 \
  --port 8118 \
  --backend vllm \
  --backend_config ./vlm_config.yaml
```

Starts the VLM stage backend; configure the full pipeline to call this server through `vl_rec_server_url` / `genai_config.server_url`.

Export and reuse a pipeline config:

```python
from paddleocr import PaddleOCR

pipeline = PaddleOCR()
pipeline.export_paddlex_config_to_yaml("ocr_config.yaml")
```

```bash
paddleocr ocr -i ./image.png --paddlex_config ./ocr_config.yaml
```

Locks model names, paths, engines, and runtime parameters into a reproducible YAML.

## Error handling

| Symptom | Likely cause | Fix |
|---|---|---|
| Program becomes unresponsive, exits unexpectedly, OOMs, or inference is extremely slow | Pipeline/model combination exceeds available CPU/GPU/memory; optional modules are enabled unnecessarily | Disable unused modules (`use_doc_orientation_classify`, `use_doc_unwarping`, `use_textline_orientation`, `use_formula_recognition`, `use_table_recognition`, etc.), choose lighter models, reduce input size/pages, reduce concurrency/batch size, or switch hardware. |
| `Prediction error: got an unexpected keyword argument 'gradient_clip'` | Legacy PaddleOCR FAQ: installed PaddlePaddle version mismatched the PaddleOCR codebase | Install a PaddlePaddle version compatible with the PaddleOCR release, or upgrade PaddleOCR and PaddlePaddle together. |
| `KeyError: 'predict'` | Legacy attention recognition model conversion issue | Update to the latest PaddleOCR code/package for that release line. |
| vLLM on T4/V100 produces timeouts or OOM during PaddleOCR-VL use | vLLM path is not recommended on older NVIDIA T4/V100-class hardware for this workload | Use native Paddle/Transformers/FastDeploy where supported, lower concurrency/model memory, or move to supported hardware. |
| vLLM/SGLang/FastDeploy backend fails on Windows | Optimized VLM backends are not natively supported on Windows | Use the official/recommended Docker/Linux deployment path or a local Paddle/Transformers path that supports the OS. |
| Dependency resolver conflicts after installing `transformers` + `vllm`/`sglang`/`fastdeploy` | Mixed inference stacks impose incompatible package constraints | Isolate backend environments. Keep local direct inference, VLM server, and full service deployment in separate virtualenvs/containers. |
| PP-StructureV3 inference is slow with defaults | The default PP-StructureV3 model set is large | Replace with lighter models from the model list, disable unneeded subpipelines, and avoid high-cost modules for quick OCR-only extraction. |
| English-only PP-StructureV3 recognition is weak | Default PP-StructureV3 text recognition model is Chinese-English | Set `text_recognition_model_name="en_PP-OCRv4_mobile_rec"` or another language-specific recognizer. |
| `PPStructure` import or usage fails in PaddleOCR 3.x | `PPStructure` from PaddleOCR 2.x was removed | Use `from paddleocr import PPStructureV3` and migrate to `paddleocr pp_structurev3` / `PPStructureV3.predict`. |
| Service response contains nonzero `errorCode` and `errorMsg` | Request schema/input failed or service-side pipeline errored | Inspect `errorMsg` and `logId`; verify `file`, `fileType`, Base64/URL accessibility, page limits, and config flags. |
| PaddleOCR-VL service rejects preprocessing-related request fields | Document preprocessing disabled in pipeline config | Enable the corresponding preprocessing option in the pipeline config before allowing clients to request it. |

## Traps

_Append-only. Date-stamped. Filled by the operator via the `/lesson`
slash command when something bites._

## Lessons

_Append-only. Date-stamped. Filled by the operator via the `/lesson`
slash command for behaviors learned that aren't in upstream docs._
