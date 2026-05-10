---
name: tool-paddle
description: Load when working with paddlepaddle, paddle tensors, CUDA wheels, distributed training, dynamic-to-static graphs, or Paddle Inference. Covers API surface, setup, errors, and lessons.
triggers:
  bash:
    - paddlepaddle
    - paddlepaddle-gpu
    - import paddle
    - from paddle
    - python -m paddle.distributed.launch
    - paddle.distributed.launch
---

# paddle

## What it is

**Assumption:** identifier "paddlepaddle" interpreted as the PaddlePaddle deep learning framework whose Python import name is `paddle`. PaddlePaddle is a Python deep-learning framework for tensor computation, neural-network training, distributed training, model export, and inference deployment. Reach for it when PaddleOCR or PaddleX requires a runtime, when training models in the Paddle ecosystem, or when running Paddle Inference. Common alternatives are PyTorch, TensorFlow, JAX, and ONNX Runtime.

## Capability surface

### Package/import names

| Surface | Name |
|---|---|
| PyPI CPU package | `paddlepaddle` |
| PyPI GPU package | `paddlepaddle-gpu` |
| Python import | `import paddle` |
| Skill directory/name | `skills/tools/paddle/SKILL.md`, `tool-paddle` |

### Distributed launch CLI

```bash
python -m paddle.distributed.launch [LAUNCH_OPTIONS] training_script [training_script_args...]
```

| Option | Purpose |
|---|---|
| `-h`, `--help` | Show launcher help. |
| `--master MASTER` | Master endpoint. Supports `host:port` and etcd endpoint forms. |
| `--rank RANK` | Rank for multi-node launch. |
| `--log_level LOG_LEVEL` | Launcher log level. |
| `--nnodes NNODES` | Number of nodes, or elastic range such as `2:4`. |
| `--nproc_per_node NPROC_PER_NODE` | Processes per node. |
| `--log_dir LOG_DIR` | Log output directory. |
| `--run_mode RUN_MODE` | Distributed run mode; examples include collective, parameter-server, RPC/IPU modes depending on runtime. |
| `--job_id JOB_ID` | Job identifier for elastic/fault-tolerant modes. |
| `--devices DEVICES` | Device list/count. Examples: `0,1,2,3`, `4` for IPU count. |
| `--host HOST` | Host address. |
| `--servers SERVERS` | Parameter-server server endpoints. |
| `--trainers TRAINERS` | Trainer endpoints. |
| `--trainer_num TRAINER_NUM` | Trainer count. |
| `--server_num SERVER_NUM` | Server count. |
| `--gloo_port GLOO_PORT` | Gloo communication port. |
| `--with_gloo WITH_GLOO` | Enable/disable Gloo where supported. |
| `training_script` | Python training script path, or special launch target such as `ipu`. |
| `training_script_args` | Args passed through to the training script. |

IPU launch accepts only `--devices`, `training_script=ipu`, and IPU-specific script args:

| IPU arg | Purpose |
|---|---|
| `--hosts` | IPU distributed training hosts. |
| `--nproc_per_host` | Processes per host. |
| `--ipus_per_replica` | IPUs per replica. |
| `--ipu_partition` | IPU partition name. |
| `--vipu_server` | IP of IPU device manager. |

Examples:

```bash
# Collective, single node, 4 GPUs
python -m paddle.distributed.launch --devices=0,1,2,3 train.py --lr=0.01

# Collective, two nodes
python -m paddle.distributed.launch --devices=0,1,2,3 --master=192.168.0.16:8090 train.py
python -m paddle.distributed.launch --devices=0,1,2,3 --master=192.168.0.16:8090 train.py

# Parameter-server simulation on one CPU node
python -m paddle.distributed.launch --server_num=2 --worker_num=4 train.py --lr=0.01

# Elastic
python -m paddle.distributed.launch --master etcd://10.0.0.1:2379 --nnodes 2:4 train.py
```

### Top-level `paddle.*` inventory

Top-level `paddle` aliases include APIs from `paddle.tensor`, `paddle.framework`, and `paddle.device`.

Classes, places, dtype/runtime constants:

| Export | Role |
|---|---|
| `Tensor` | Basic tensor data structure. |
| `DataParallel` | Dynamic graph data parallel wrapper. |
| `CPUPlace`, `CUDAPlace`, `CUDAPinnedPlace`, `XPUPlace`, `CustomPlace`, `IPUPlace` | Device/place descriptors. |
| `ParamAttr`, `LazyGuard` | Parameter and lazy-init helpers. |
| `bool`, `uint8`, `int8`, `int16`, `int32`, `int64`, `bfloat16`, `float16`, `float32`, `float64`, `complex64`, `complex128` | Dtype exports. |
| `version`, `__version__` | Version metadata. |

Tensor creation / conversion / shape:

`arange`, `as_complex`, `as_real`, `as_strided`, `assign`, `broadcast_shape`, `broadcast_tensors`, `broadcast_to`, `bucketize`, `cartesian_prod`, `cast`, `check_shape`, `clone`, `complex`, `concat`, `crop`, `diag`, `diag_embed`, `diagflat`, `diagonal`, `empty`, `empty_like`, `expand`, `expand_as`, `eye`, `flatten`, `flip`, `full`, `full_like`, `gather`, `gather_nd`, `hstack`, `imag`, `is_complex`, `is_empty`, `is_floating_point`, `is_integer`, `is_tensor`, `linspace`, `meshgrid`, `moveaxis`, `nonzero`, `numel`, `ones`, `ones_like`, `permutation`, `put_along_axis`, `rank`, `real`, `repeat_interleave`, `reshape`, `reverse`, `roll`, `rot90`, `shape`, `slice`, `split`, `squeeze`, `squeeze_`, `stack`, `strided_slice`, `t`, `take`, `take_along_axis`, `tile`, `to_tensor`, `transpose`, `tril_indices`, `triu_indices`, `unbind`, `unflatten`, `unique`, `unique_consecutive`, `unsqueeze`, `unsqueeze_`, `unstack`, `vander`, `view`, `view_as_complex`, `view_as_real`, `vsplit`, `where`, `zeros`, `zeros_like`.

Math / elementwise / reductions:

`abs`, `abs_`, `acos`, `acos_`, `acosh`, `acosh_`, `add`, `add_`, `add_n`, `addmm`, `all`, `allclose`, `amax`, `amin`, `angle`, `any`, `argmax`, `argmin`, `argsort`, `asin`, `asin_`, `asinh`, `asinh_`, `atan`, `atan_`, `atan2`, `atanh`, `atanh_`, `baddbmm`, `bitwise_and`, `bitwise_not`, `bitwise_or`, `bitwise_xor`, `bmm`, `ceil`, `ceil_`, `cholesky`, `chunk`, `clip`, `clip_`, `coalesce`, `combinations`, `conj`, `cos`, `cos_`, `cosh`, `cosh_`, `count_nonzero`, `cross`, `cummax`, `cummin`, `cumprod`, `cumsum`, `cumsum_`, `deg2rad`, `diff`, `digamma`, `digamma_`, `disable_signal_handler`, `dist`, `divide`, `divide_`, `dot`, `einsum`, `equal`, `equal_all`, `erf`, `erf_`, `erfinv`, `erfinv_`, `exp`, `exp_`, `expm1`, `expm1_`, `floor`, `floor_`, `floor_divide`, `floor_divide_`, `floor_mod`, `floor_mod_`, `frac`, `frac_`, `frexp`, `gcd`, `gcd_`, `greater_equal`, `greater_than`, `histogram`, `i0`, `i0_`, `increment`, `index_add`, `index_put`, `index_sample`, `index_select`, `inner`, `inverse`, `isclose`, `isfinite`, `isinf`, `isnan`, `kron`, `kthvalue`, `lcm`, `lcm_`, `lerp`, `lerp_`, `less_equal`, `less_than`, `lgamma`, `lgamma_`, `log`, `log_`, `log1p`, `log1p_`, `log2`, `log2_`, `log10`, `log10_`, `logaddexp`, `logaddexp2`, `logical_and`, `logical_not`, `logical_or`, `logical_xor`, `logit`, `logit_`, `masked_fill`, `masked_scatter`, `matmul`, `max`, `maximum`, `mean`, `median`, `min`, `minimum`, `mm`, `mod`, `multigammaln`, `multigammaln_`, `multiplex`, `multiply`, `multiply_`, `nan_to_num`, `nan_to_num_`, `nanmedian`, `nextafter`, `normal`, `outer`, `pca_lowrank`, `pdist`, `pinverse`, `polar`, `polygamma`, `polygamma_`, `pow`, `pow_`, `prod`, `quantile`, `rad2deg`, `reciprocal`, `reciprocal_`, `remainder`, `renorm`, `renorm_`, `rsqrt`, `rsqrt_`, `scale`, `scatter`, `scatter_`, `scatter_add`, `scatter_nd_add`, `searchsorted`, `sgn`, `sign`, `signbit`, `sin`, `sin_`, `sinh`, `sinh_`, `sort`, `sqrt`, `sqrt_`, `square`, `square_`, `standard_gamma`, `std`, `subtract`, `subtract_`, `sum`, `tan`, `tan_`, `tanh`, `tanh_`, `tensordot`, `topk`, `trace`, `trapezoid`, `tril`, `tril_`, `triu`, `triu_`, `trunc`, `trunc_`, `var`.

Random / state / device / gradients / serialization:

`bernoulli`, `binomial`, `create_parameter`, `decomposition`, `enable_grad`, `fft`, `get_autocast_dtype`, `get_cuda_rng_state`, `get_default_dtype`, `get_device`, `get_rng_state`, `in_dynamic_mode`, `in_dynamic_or_pir_mode`, `in_pir_mode`, `is_compiled_with_cuda`, `is_compiled_with_custom_device`, `is_compiled_with_rocm`, `is_grad_enabled`, `load`, `no_grad`, `rand`, `randint`, `randn`, `randperm`, `save`, `seed`, `set_autocast_dtype`, `set_cuda_rng_state`, `set_default_dtype`, `set_device`, `set_grad_enabled`, `set_printoptions`, `set_rng_state`, `sysconfig`.

### Official module inventory

| Module | Public surface / role |
|---|---|
| `paddle.tensor` | Tensor creation, indexing, shape, math, comparison, random, linalg-adjacent tensor operations. |
| `paddle.framework` | Core dynamic/static mode controls, device/dtype defaults, parameter creation, serialization, `no_grad`, `enable_grad`, `set_grad_enabled`. |
| `paddle.amp` | Automatic mixed precision: `auto_cast`, `GradScaler`, `decorate`, AMP availability checks, excluded layers, unscale/debug helpers. |
| `paddle.audio` | Audio datasets, features, functional transforms, I/O, sox effects, and transforms. |
| `paddle.autograd` | `backward`, `grad`, `jacobian`, `hessian`, `PyLayer`, gradient-enable controls. |
| `paddle.callbacks` | Training callbacks: `Callback`, `ProgBarLogger`, `History`, `ModelCheckpoint`, `EarlyStopping`, `ReduceLROnPlateau`, `LRScheduler`, `VisualDL`, `WandbCallback`, remote monitor patterns. |
| `paddle.compat` | Python compatibility helpers for text/bytes/numeric handling. |
| `paddle.cuda` | CUDA streams/events/graphs, memory stats, device properties, current/default streams, synchronization, availability. |
| `paddle.device` | Device selection and discovery: CPU/GPU/custom device APIs, CUDA/CUDNN version, `get_device`, `set_device`, `synchronize`. |
| `paddle.distributed` | Distributed training/process launch, collectives, rank/world-size APIs, groups, send/recv, spawn, launch, sharding, RPC/PS/collective tooling. |
| `paddle.distributed.fleet` | Fleet distributed strategies, role makers, optimizers, parameter-server/fleet utilities. |
| `paddle.distribution` | Probability distributions and transforms: `Distribution`, `Normal`, `Uniform`, `Categorical`, `Bernoulli`, `Binomial`, `Beta`, `Dirichlet`, `Gamma`, `Exponential`, `Laplace`, `Multinomial`, `Poisson`, `StudentT`, `TransformedDistribution`, constraints/transforms. |
| `paddle.fft` | `fft`, `ifft`, `rfft`, `irfft`, `hfft`, `ihfft`, 2D/ND variants, `fftfreq`, `rfftfreq`, `fftshift`, `ifftshift`. |
| `paddle.geometric` | Graph/geometric tensor operators such as message passing, segment/pool, graph utility operations. |
| `paddle.hub` | Hub/model loading utilities. |
| `paddle.incubate` | Experimental APIs: ASP, autograd, checkpointing, distributed, layers, NN, optimizer, tensor, XPU-related experimental functionality. |
| `paddle.io` | Data loading: `Dataset`, `IterableDataset`, `TensorDataset`, `DataLoader`, samplers, `DistributedBatchSampler`, `random_split`, `get_worker_info`. |
| `paddle.inference` | Paddle Inference runtime: `Config`, `Predictor`, `create_predictor`, precision/place/data-type enums. |
| `paddle.jit` | Dynamic-to-static conversion and serialization: `to_static`, `not_to_static`, `save`, `load`, `TranslatedLayer`, debugging verbosity/code-level controls. |
| `paddle.linalg` | Linear algebra: `cholesky`, `cond`, `cross`, `det`, `eig`, `eigh`, `eigvals`, `eigvalsh`, `inv`, `lstsq`, `lu`, `lu_solve`, `matrix_power`, `matrix_rank`, `multi_dot`, `norm`, `pinv`, `qr`, `slogdet`, `solve`, `svd`, `svdvals`, `triangular_solve`. |
| `paddle.metric` | Metrics: `Metric`, `Accuracy`, `Auc`, `Precision`, `Recall`, `accuracy`. |
| `paddle.nn` | Layers, containers, losses, activations, convolutions, normalization, pooling, recurrent layers, transformer/multi-head attention, embeddings, dropout, clipping, initializer namespace, functional namespace. |
| `paddle.nn.functional` | Functional forms for activations, convolutions, losses, normalizations, pooling, attention, sampling/interpolation, vision-style ops. |
| `paddle.onnx` | ONNX export helpers. |
| `paddle.optimizer` | Optimizers: `SGD`, `Momentum`, `Adam`, `AdamW`, `RMSProp`, `Adagrad`, `Adadelta`, `Adamax`, `NAdam`, `Lamb`, `LBFGS`, `ASGD`, `RAdam`, optimizer base classes. |
| `paddle.optimizer.lr` | Learning-rate schedulers: piecewise, polynomial, exponential, natural exponential, inverse-time, cosine annealing, noam, linear warmup, reduce-on-plateau, lambda, cyclic, multi-step. |
| `paddle.profiler` | Profiling: `Profiler`, profiler targets/states, scheduler creation, Chrome tracing export. |
| `paddle.random` | RNG state and random tensor utilities. |
| `paddle.quantization` | Quantization-aware training/configuration and imperative quantization utilities. |
| `paddle.regularizer` | `L1Decay`, `L2Decay`, regularizer base. |
| `paddle.signal` | Signal processing: STFT/ISTFT/spectrogram/window-related APIs. |
| `paddle.sparse` | Sparse COO/CSR tensors and sparse operators. |
| `paddle.sparse.nn` | Sparse neural-network layers and functional ops. |
| `paddle.static` | Static graph `Program`, `Executor`, `InputSpec`, `data`, program guards, save/load inference models, static NN namespace. |
| `paddle.static.nn` | Static graph NN layers/operators. |
| `paddle.sysconfig` | Build/include/library path helpers. |
| `paddle.text` | Text utilities/datasets/sequence helpers. |
| `paddle.utils` | Utilities including `run_check`, download/install checks, C++ extension helpers, unique-name helpers. |
| `paddle.vision` | Vision datasets, models, transforms, and ops. |

### `paddle.nn` inventory

Containers / base:

`Layer`, `Sequential`, `LayerList`, `LayerDict`, `ParameterList`, `Pad1D`, `Pad2D`, `Pad3D`, `Flatten`, `Identity`, `ClipGradByGlobalNorm`, `ClipGradByNorm`, `ClipGradByValue`.

Core layers:

`Linear`, `Bilinear`, `Embedding`, `Conv1D`, `Conv2D`, `Conv3D`, `Conv1DTranspose`, `Conv2DTranspose`, `Conv3DTranspose`, `Upsample`, `PixelShuffle`, `PixelUnshuffle`.

Normalization:

`BatchNorm`, `BatchNorm1D`, `BatchNorm2D`, `BatchNorm3D`, `SyncBatchNorm`, `GroupNorm`, `LayerNorm`, `InstanceNorm1D`, `InstanceNorm2D`, `InstanceNorm3D`, `LocalResponseNorm`, `SpectralNorm`.

Activations:

`ReLU`, `ReLU6`, `LeakyReLU`, `PReLU`, `ELU`, `CELU`, `SELU`, `GELU`, `Sigmoid`, `Softmax`, `Softmax2D`, `LogSoftmax`, `Softplus`, `Softsign`, `Tanh`, `Tanhshrink`, `Hardswish`, `Hardsigmoid`, `Hardshrink`, `Hardtanh`, `Swish`, `Mish`, `SiLU`, `ThresholdedReLU`, `Maxout`.

Pooling:

`AvgPool1D`, `AvgPool2D`, `AvgPool3D`, `MaxPool1D`, `MaxPool2D`, `MaxPool3D`, `AdaptiveAvgPool1D`, `AdaptiveAvgPool2D`, `AdaptiveAvgPool3D`, `AdaptiveMaxPool1D`, `AdaptiveMaxPool2D`, `AdaptiveMaxPool3D`, `FractionalMaxPool2D`, `FractionalMaxPool3D`, `LPPool1D`, `LPPool2D`.

Recurrent / attention / transformer:

`RNN`, `RNNCellBase`, `SimpleRNN`, `SimpleRNNCell`, `LSTM`, `LSTMCell`, `GRU`, `GRUCell`, `MultiHeadAttention`, `Transformer`, `TransformerEncoder`, `TransformerEncoderLayer`, `TransformerDecoder`, `TransformerDecoderLayer`.

Dropout:

`Dropout`, `Dropout1D`, `Dropout2D`, `Dropout3D`, `AlphaDropout`, `FeatureAlphaDropout`.

Losses:

`BCELoss`, `BCEWithLogitsLoss`, `CrossEntropyLoss`, `NLLLoss`, `KLDivLoss`, `MSELoss`, `L1Loss`, `SmoothL1Loss`, `HuberLoss`, `MarginRankingLoss`, `TripletMarginLoss`, `TripletMarginWithDistanceLoss`, `MultiLabelSoftMarginLoss`, `CosineEmbeddingLoss`, `CTCLoss`.

Initializers namespace:

`paddle.nn.initializer.Constant`, `Uniform`, `Normal`, `XavierUniform`, `XavierNormal`, `KaimingUniform`, `KaimingNormal`, `TruncatedNormal`, `Assign`, `Bilinear`, `Dirac`, `Orthogonal`.

### `paddle.io` inventory

| Export | Role |
|---|---|
| `Dataset`, `IterableDataset`, `TensorDataset`, `ChainDataset`, `Subset` | Dataset abstractions. |
| `DataLoader` | Batch loading with workers/pinning/shuffle controls. |
| `Sampler`, `BatchSampler`, `RandomSampler`, `SequenceSampler`, `DistributedBatchSampler`, `WeightedRandomSampler` | Sampling strategies. |
| `random_split` | Split dataset into non-overlapping subsets. |
| `get_worker_info` | Access DataLoader worker metadata. |

### `paddle.inference` inventory

| Export | Role |
|---|---|
| `Config` | Runtime config for Paddle Inference. |
| `Predictor` | Inference predictor object. |
| `create_predictor(config)` | Build predictor from `Config`. |
| `PrecisionType`, `PlaceType`, `DataType` | Runtime enum groups. |

### `paddle.vision` inventory

| Group | Exports |
|---|---|
| Datasets | `Cifar10`, `Cifar100`, `MNIST`, `FashionMNIST`, `VOC2012`, `Flowers`, `DatasetFolder`, `ImageFolder`. |
| Models | `LeNet`, `AlexNet`, `VGG`, `ResNet`, `ResNeXt`, `WideResNet`, `DenseNet`, `SqueezeNet`, `GoogLeNet`, `InceptionV3`, `MobileNetV1`, `MobileNetV2`, `MobileNetV3`, `ShuffleNetV2`. |
| Ops | `DeformConv2D`, `RoIAlign`, `RoIPool`, `PSRoIAlign`, `PSRoIPool`, `yolo_box`, NMS/box helpers where exposed. |
| Transforms | `Compose`, `Resize`, `CenterCrop`, `RandomCrop`, `RandomHorizontalFlip`, `RandomVerticalFlip`, `RandomRotation`, `RandomResizedCrop`, `Pad`, `Normalize`, `ToTensor`, `Transpose`, `Grayscale`, `ColorJitter`, `RandomAffine`, `RandomErasing`, `BaseTransform`. |

## Setup & auth

Install requirements from official docs:

| Requirement | Supported / required |
|---|---|
| OS | Windows 10/11 Pro/Enterprise; Ubuntu 20.04/22.04/24.04; AlmaLinux 8; macOS 12.x/13.x/14.x/15.x. |
| Architecture | 64-bit x86_64 / x64 / Intel 64 / AMD64. Current docs state ARM64 is not supported. |
| CPU | Processor supports MKL. |
| Python | 3.9, 3.10, 3.11, 3.12, 3.13. |
| pip | 20.2.2 or newer; 64-bit Python/pip. |
| GPU | Local GPU driver must satisfy Paddle package/runtime requirements. Current docs state Paddle handles CUDA/cuDNN package dependencies for user installation; still select the correct wheel index. |

Create environment:

```bash
python -m venv .venv
. .venv/bin/activate
python -m pip install -U pip
```

Check interpreter and architecture:

```bash
python --version
python -m pip --version
python -c "import platform;print(platform.architecture()[0]);print(platform.machine())"
```

Install CPU wheel:

```bash
python -m pip install paddlepaddle==3.3.0 -i https://www.paddlepaddle.org.cn/packages/stable/cpu/
```

Install GPU wheel. Select one matching the machine/runtime constraints:

```bash
python -m pip install paddlepaddle-gpu==3.3.0 -i https://www.paddlepaddle.org.cn/packages/stable/cu118/
python -m pip install paddlepaddle-gpu==3.3.0 -i https://www.paddlepaddle.org.cn/packages/stable/cu126/
python -m pip install paddlepaddle-gpu==3.3.0 -i https://www.paddlepaddle.org.cn/packages/stable/cu129/
python -m pip install paddlepaddle-gpu==3.3.0 -i https://www.paddlepaddle.org.cn/packages/stable/cu130/
```

Verify:

```bash
python - <<'PY'
import paddle
paddle.utils.run_check()
print("paddle", paddle.__version__)
print("compiled with cuda:", paddle.is_compiled_with_cuda())
print("device:", paddle.get_device())
PY
```

Docker install is an official alternative. Example image tags exist for `paddlepaddle/paddle:3.3.0`, `paddlepaddle/paddle:3.3.0-jupyter`, and GPU CUDA/CUDNN variants. Use Docker when host Python/CUDA packaging is unstable or backend tooling requires Linux.

Credentials:

| Area | Secret needed |
|---|---|
| Local training/inference | None. |
| Docker registry mirrors | Registry auth only if the chosen registry requires it. Do not inline. |
| Cloud/distributed infrastructure | Cluster credentials, SSH keys, object storage keys, or service tokens come from the operator/cloud provider. Do not inline. |

State and environment:

| Item | Location / variable |
|---|---|
| Python package state | Active virtualenv/site-packages. |
| Pip wheel/cache | Standard pip cache for the current user. |
| Device selection | `paddle.set_device("gpu:0")`, `paddle.set_device("cpu")`, and `CUDA_VISIBLE_DEVICES`. |
| Distributed launch | `python -m paddle.distributed.launch ...`. |
| Dynamic-to-static native error stack | Set `TRANSLATOR_DISABLE_NEW_ERROR=1`. |
| C++ stack traces | Set `FLAGS_call_stack_level=2`. |
| Dynamic-to-static conversion logs | `paddle.jit.set_verbosity(level)` or `TRANSLATOR_VERBOSITY=level`; levels `0` to `3`. |
| AMP | `paddle.amp.auto_cast`, `paddle.amp.GradScaler`, `paddle.amp.decorate`. |

## Common workflows

Install and verify CPU runtime:

```bash
python -m pip install paddlepaddle==3.3.0 -i https://www.paddlepaddle.org.cn/packages/stable/cpu/
python - <<'PY'
import paddle
paddle.utils.run_check()
print(paddle.__version__)
PY
```

Confirms the framework imports and passes Paddle's install check.

Basic tensor + layer + optimizer:

```python
import paddle
import paddle.nn as nn

paddle.set_device("cpu")
x = paddle.randn([8, 4])
y = paddle.randn([8, 2])

model = nn.Sequential(nn.Linear(4, 16), nn.ReLU(), nn.Linear(16, 2))
loss_fn = nn.MSELoss()
optim = paddle.optimizer.Adam(learning_rate=1e-3, parameters=model.parameters())

pred = model(x)
loss = loss_fn(pred, y)
loss.backward()
optim.step()
optim.clear_grad()
print(float(loss))
```

Runs one dynamic-graph optimization step.

Use AMP on supported GPU:

```python
import paddle

scaler = paddle.amp.GradScaler()
with paddle.amp.auto_cast():
    pred = model(x)
    loss = loss_fn(pred, y)

scaled = scaler.scale(loss)
scaled.backward()
scaler.minimize(optim, scaled)
optim.clear_grad()
```

Uses mixed precision; disable when GPU capability or model shape produces no speedup.

Launch multi-GPU distributed training:

```bash
python -m paddle.distributed.launch --devices=0,1,2,3 train.py --lr=0.01
```

Starts one training process per listed GPU.

Initialize distributed dynamic graph code:

```python
import paddle
import paddle.distributed as dist

dist.init_parallel_env()
model = paddle.DataParallel(model)
```

Wraps the model for data-parallel execution after launch/spawn.

Export dynamic model to static/inference form:

```python
import paddle

static_model = paddle.jit.to_static(model)
paddle.jit.save(static_model, "export/model")
loaded = paddle.jit.load("export/model")
```

Converts and serializes a model for static/inference workflows.

Increase dynamic-to-static debugging detail:

```bash
TRANSLATOR_VERBOSITY=3 FLAGS_call_stack_level=2 python train.py
```

Prints conversion logs and C++ stack information. Check logs for sensitive code before sharing.

## Error handling

| Symptom | Likely cause | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named 'paddle'` | PaddlePaddle is not installed in the active Python environment, or the wrong Python executable is running | Activate the intended venv; run `which python`/`where python`; install `paddlepaddle` or `paddlepaddle-gpu`; verify with `import paddle; paddle.utils.run_check()`. |
| `ERROR: No matching distribution found for paddlepaddle` | Python version, pip version, architecture, OS, or platform does not match official wheel requirements | Use Python 3.9-3.13, pip 20.2.2+, 64-bit x86_64, and a supported OS; avoid ARM64 unless using a documented supported build path. |
| `UserWarning: AMP only support NVIDIA GPU with Compute Capability 7.0 or higher, current GPU is: Tesla K40m, with Compute Capability: 3.5;` | GPU does not support Tensor Core/AMP acceleration target | Disable AMP for that hardware, or run on supported NVIDIA GPU. |
| No acceleration effect or speed decrease after AMP training | GPU lacks AMP acceleration support, or model is light on matmul/conv and heavy on scheduling | Turn off mixed precision for the workload; verify GPU utilization with `nvidia-smi`. |
| `For distributed AMP training, you should first use paddle.amp.decorate() to decotate origin model, and then call paddle.DataParallel get distributed model.` | AMP-O2 applied after wrapping model in distributed `DataParallel` | Call `paddle.amp.decorate(models=model, level='O2')` before `paddle.DataParallel(model)`. |
| `RuntimeError: (NotFound) Input("Filter") of ConvOp should not be null.` | Dynamic-to-static conversion produced a static op with missing converted input/weight; often sublayer inheritance/call-path issue | Confirm sublayers inherit `nn.Layer`, call through `forward`, and use pdb/static-code print to inspect converted objects. |
| `[Hint: Expected input_dims[i] == input_dims[0], but received input_dims[i]:-1, -1 != input_dims[0]:16, -1.]` | Static graph shape inference failed; `-1`/unknown dims propagated through reshape/API behavior | Avoid overusing `-1` in static reshape paths; debug dynamic vs static shape behavior; inspect upstream `reshape` outputs. |
| `[Hint: Expected desc->CheckGuards() == true, but received desc->CheckGuards():0 != true: 1.]` | Dynamic-to-static guard failure, commonly complex Tensor slice syntax | Replace complex Tensor slicing with `paddle.slice` where possible and inspect converted static code. |
| Segment fault during dynamic-to-static conversion | Static conversion touches dynamic tensors/parameters created incorrectly, e.g. sublayer not inheriting `nn.Layer` or `paddle.to_tensor` in `__init__` | Ensure every sublayer inherits `nn.Layer`; move dynamic tensor creation out of `__init__` when it becomes static graph state. |
| Paddle dynamic-to-static error stack is too processed to diagnose | New dynamic-to-static error reporting hides native stack | Set `TRANSLATOR_DISABLE_NEW_ERROR=1` to view native error stack. |
| C++ operator failure lacks useful call stack | C++ stack hidden by default | Set `FLAGS_call_stack_level=2` before running. |
| Dynamic-to-static conversion behavior unclear | Conversion logs disabled | Set `TRANSLATOR_VERBOSITY=1..3` or call `paddle.jit.set_verbosity(level=3, also_to_stdout=True)`. |
| Model parameters missing when parameters are stored in a Python list | Raw Python lists do not register parameters/layers with `Layer.parameters()` | Use `paddle.nn.ParameterList` for parameters and `paddle.nn.LayerList` for sublayers. |

## Traps

_Append-only. Date-stamped. Filled by the operator via the `/lesson`
slash command when something bites._

## Lessons

_Append-only. Date-stamped. Filled by the operator via the `/lesson`
slash command for behaviors learned that aren't in upstream docs._
