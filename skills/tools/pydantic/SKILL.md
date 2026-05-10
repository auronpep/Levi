---
name: tool-pydantic
description: Load when working with pydantic, BaseModel validation, TypeAdapter, ConfigDict, field validators, JSON schema, or V1 migration. Covers full Python API surface, setup, error handling, and lessons.
triggers:
  bash: []
---

# pydantic

## What it is

Pydantic is a Python data-validation, serialization, and schema-generation library driven by type annotations. Reach for it when incoming Python objects, JSON payloads, API DTOs, configuration objects, dataclasses, or arbitrary annotated types need runtime validation and structured serialization; common alternatives are `dataclasses`, `attrs`, `cattrs`, `marshmallow`, and schema-specific validators. This is a pure Python library skill: `triggers.bash` is empty, so load it explicitly when editing Python that imports or depends on `pydantic`.

## Capability surface

### Package map

| Module | Public surface |
|---|---|
| `pydantic` | Primary exports: models, fields, validators, serializers, aliases, config, JSON schema helpers, network types, strict/constrained types, error classes, version info. |
| `pydantic.dataclasses` | Pydantic-validated dataclass decorator and rebuild/introspection helpers. |
| `pydantic.alias_generators` | `to_pascal`, `to_camel`, `to_snake`. |
| `pydantic.fields` | `FieldInfo`, `Field`, `PrivateAttr`, `computed_field`, `ModelPrivateAttr`, `ComputedFieldInfo`. |
| `pydantic.functional_validators` | `AfterValidator`, `BeforeValidator`, `PlainValidator`, `WrapValidator`, `InstanceOf`, `SkipValidation`, `ValidateAs`, `field_validator`, `model_validator`, validator protocol aliases. |
| `pydantic.functional_serializers` | `PlainSerializer`, `WrapSerializer`, `SerializeAsAny`, `field_serializer`, `model_serializer`, serializer protocol aliases. |
| `pydantic.json_schema` | `GenerateJsonSchema`, `WithJsonSchema`, `SkipJsonSchema`, `model_json_schema`, `models_json_schema`, schema mode/value aliases, warning classes. |
| `pydantic.networks` | URL, DSN, email, and IP address types plus `validate_email`. |
| `pydantic.types` | Strict, constrained, secret, encoded, temporal, UUID, path, JSON, discriminator, and helper annotation types. |
| `pydantic.errors` | Pydantic-specific user/config/schema errors. |
| `pydantic.version` | `__version__`, `version_info()`. |
| `pydantic.v1` | Bundled compatibility namespace for Pydantic V1 APIs. Use during incremental migration only. |

### `pydantic.BaseModel`

Base class for structured models with validation, serialization, JSON schema, computed/private fields, and config via `model_config`.

#### Class/instance attributes

| Attribute | Type / meaning |
|---|---|
| `model_config` | `ConfigDict`; model configuration. |
| `model_fields` | `dict[str, FieldInfo]`; class-level mapping of field names to field metadata. Instance access deprecated for V3. |
| `model_computed_fields` | `dict[str, ComputedFieldInfo]`; class-level mapping of computed fields. Instance access deprecated for V3. |
| `model_fields_set` | `set[str]`; field names explicitly set during validation/construction. |
| `__class_vars__` | `set[str]`; names of class variables. |
| `__private_attributes__` | `dict[str, ModelPrivateAttr]`; private attribute metadata. |
| `__signature__` | `inspect.Signature`; synthesized `__init__` signature. |
| `__pydantic_complete__` | `bool`; schema/model build completion state. |
| `__pydantic_core_schema__` | `CoreSchema`; pydantic-core schema. |
| `__pydantic_custom_init__` | `bool`; whether custom `__init__` exists. |
| `__pydantic_decorators__` | Decorator metadata replacing V1 `__validators__` / `__root_validators__`. |
| `__pydantic_generic_metadata__` | Generic model metadata. |
| `__pydantic_parent_namespace__` | Parent namespace used for automatic rebuilds. |
| `__pydantic_post_init__` | `None` or `'model_post_init'`. |
| `__pydantic_root_model__` | `bool`; whether subclass is a `RootModel`. |
| `__pydantic_serializer__` | pydantic-core `SchemaSerializer`. |
| `__pydantic_validator__` | pydantic-core `SchemaValidator` or plugin validator. |
| `__pydantic_fields__` | `dict[str, FieldInfo]`; internal field metadata. |
| `__pydantic_computed_fields__` | `dict[str, ComputedFieldInfo]`; internal computed field metadata. |
| `__pydantic_extra__` | `dict[str, Any] | None`; extra data when `extra='allow'`. |
| `__pydantic_fields_set__` | `set[str]`; explicit field set. |
| `__pydantic_private__` | `dict[str, Any] | None`; private attribute values. |

#### Constructor and core methods

```python
def __init__(self, /, **data: Any) -> None
```
Raises `ValidationError` if input data cannot form a valid model. `self` is positional-only so `self` can be a field name.

```python
@classmethod
def model_construct(
    cls,
    _fields_set: set[str] | None = None,
    **values: Any,
) -> Self
```
Constructs from trusted/prevalidated data. No validation. Defaults are applied. Extra handling: `allow` stores extra, `ignore` ignores, `forbid` does not raise and ignores.

```python
def model_copy(
    self,
    *,
    update: Mapping[str, Any] | None = None,
    deep: bool = False,
) -> Self
```
Copies model. `update` is not validated. `deep=True` deep-copies values.

```python
def model_dump(
    self,
    *,
    mode: Literal['json', 'python'] | str = 'python',
    include: IncEx | None = None,
    exclude: IncEx | None = None,
    context: Any | None = None,
    by_alias: bool | None = None,
    exclude_unset: bool = False,
    exclude_defaults: bool = False,
    exclude_none: bool = False,
    exclude_computed_fields: bool = False,
    round_trip: bool = False,
    warnings: bool | Literal['none', 'warn', 'error'] = True,
    fallback: Callable[[Any], Any] | None = None,
    serialize_as_any: bool = False,
    polymorphic_serialization: bool | None = None,
) -> dict[str, Any]
```
Serializes to Python dict. `mode='json'` emits JSON-compatible Python values. `warnings='error'` raises serialization errors. `round_trip=True` targets values suitable as input for non-idempotent types such as `Json[T]`.

```python
def model_dump_json(
    self,
    *,
    indent: int | None = None,
    ensure_ascii: bool = False,
    include: IncEx | None = None,
    exclude: IncEx | None = None,
    context: Any | None = None,
    by_alias: bool | None = None,
    exclude_unset: bool = False,
    exclude_defaults: bool = False,
    exclude_none: bool = False,
    exclude_computed_fields: bool = False,
    round_trip: bool = False,
    warnings: bool | Literal['none', 'warn', 'error'] = True,
    fallback: Callable[[Any], Any] | None = None,
    serialize_as_any: bool = False,
    polymorphic_serialization: bool | None = None,
) -> str
```
Serializes model to JSON string.

```python
@classmethod
def model_json_schema(
    cls,
    by_alias: bool = True,
    ref_template: str = DEFAULT_REF_TEMPLATE,
    schema_generator: type[GenerateJsonSchema] = GenerateJsonSchema,
    mode: JsonSchemaMode = 'validation',
    union_format: Literal['any_of', 'primitive_type_array'] = 'any_of',
) -> dict[str, Any]
```
Generates JSON Schema for a model class.

```python
@classmethod
def model_parametrized_name(cls, params: tuple[type[Any], ...]) -> str
```
Computes concrete names for generic model parametrizations. Raises `TypeError` on non-generic models.

```python
def model_post_init(self, context: Any) -> None
```
Override for post-`__init__` and post-`model_construct` initialization.

```python
@classmethod
def model_rebuild(
    cls,
    *,
    force: bool = False,
    raise_errors: bool = True,
    _parent_namespace_depth: int = 2,
    _types_namespace: MappingNamespace | None = None,
) -> bool | None
```
Rebuilds unresolved schema/forward references. Returns `None` when complete/no rebuild needed, else `True` or `False`.

```python
@classmethod
def model_validate(
    cls,
    obj: Any,
    *,
    strict: bool | None = None,
    extra: ExtraValues | None = None,
    from_attributes: bool | None = None,
    context: Any | None = None,
    by_alias: bool | None = None,
    by_name: bool | None = None,
) -> Self
```
Validates a Python object into the model. Raises `ValidationError`.

```python
@classmethod
def model_validate_json(
    cls,
    json_data: str | bytes | bytearray,
    *,
    strict: bool | None = None,
    extra: ExtraValues | None = None,
    context: Any | None = None,
    by_alias: bool | None = None,
    by_name: bool | None = None,
) -> Self
```
Validates JSON bytes/string into the model. Raises `ValidationError` for invalid JSON or invalid object.

```python
@classmethod
def model_validate_strings(
    cls,
    obj: Any,
    *,
    strict: bool | None = None,
    extra: ExtraValues | None = None,
    context: Any | None = None,
    by_alias: bool | None = None,
    by_name: bool | None = None,
) -> Self
```
Validates stringly-typed mapping data.

```python
def create_model(
    model_name: str,
    __config__: ConfigDict | None = None,
    __doc__: str | None = None,
    __base__: type[ModelT] | tuple[type[ModelT], ...] | None = None,
    __module__: str | None = None,
    __validators__: dict[str, Callable[..., Any]] | None = None,
    __cls_kwargs__: dict[str, Any] | None = None,
    __qualname__: str | None = None,
    **field_definitions: Any | tuple[Any, Any],
) -> type[BaseModel] | type[ModelT]
```
Dynamically creates a `BaseModel` subclass. Field definitions are annotation-only or `(annotation, default)` tuples. May execute code in string annotations during evaluation.

#### Deprecated V1-style methods still encountered

| V1-style name | V2 replacement |
|---|---|
| `dict()` | `model_dump()` |
| `json()` | `model_dump_json()` |
| `parse_obj()` | `model_validate()` |
| `parse_raw()` | `model_validate_json()` or load external format before `model_validate()` |
| `parse_file()` | Load file content then `model_validate_json()` or `model_validate()` |
| `construct()` | `model_construct()` |
| `copy()` | `model_copy()` |
| `schema()` | `model_json_schema()` |
| `schema_json()` | `json.dumps(model_json_schema())` |
| `update_forward_refs()` | `model_rebuild()` |

### `pydantic.RootModel`

```python
class RootModel(BaseModel, Generic[RootModelRootType])
```
Model wrapper for a single root object.

| Attribute | Meaning |
|---|---|
| `root` | The root object. |
| `__pydantic_root_model__` | `True` for root models. |
| `__pydantic_private__` | Private fields. |
| `__pydantic_extra__` | Extra fields placeholder; `RootModel` cannot store extra fields. |

```python
@classmethod
def model_construct(
    cls,
    root: RootModelRootType,
    _fields_set: set[str] | None = None,
) -> Self
```
Constructs root model from trusted root value.

```python
def model_dump(
    self,
    *,
    mode: Literal['json', 'python'] | str = 'python',
    include: Any = None,
    exclude: Any = None,
    context: dict[str, Any] | None = None,
    by_alias: bool | None = None,
    exclude_unset: bool = False,
    exclude_defaults: bool = False,
    exclude_none: bool = False,
    exclude_computed_fields: bool = False,
    round_trip: bool = False,
    warnings: bool | Literal['none', 'warn', 'error'] = True,
    serialize_as_any: bool = False,
) -> Any
```
Type-checker-specific return-type override; behavior follows `BaseModel.model_dump()`.

### `pydantic.dataclasses`

```python
def dataclass(
    _cls: type[_T] | None = None,
    *,
    init: Literal[False] = False,
    repr: bool = True,
    eq: bool = True,
    order: bool = False,
    unsafe_hash: bool = False,
    frozen: bool | None = None,
    config: ConfigDict | type[object] | None = None,
    validate_on_init: bool | None = None,
    kw_only: bool = False,
    slots: bool = False,
) -> Callable[[type[_T]], type[PydanticDataclass]] | type[PydanticDataclass]
```
Decorator equivalent to `dataclasses.dataclass` with Pydantic validation. `init` must be `False`; `validate_on_init=False` is invalid/deprecated because V2 validates on init.

```python
def rebuild_dataclass(
    cls: type[PydanticDataclass],
    *,
    force: bool = False,
    raise_errors: bool = True,
    _parent_namespace_depth: int = 2,
    _types_namespace: MappingNamespace | None = None,
) -> bool | None
```
Rebuilds dataclass schema for unresolved forward refs.

```python
def is_pydantic_dataclass(class_: type[Any]) -> TypeGuard[type[PydanticDataclass]]
```
Returns `True` for Pydantic dataclasses.

### `pydantic.TypeAdapter`

```python
class TypeAdapter(Generic[T])
```
Adapter for validation, serialization, and JSON schema for arbitrary annotated types that are not `BaseModel` subclasses.

Constructor parameters:

| Parameter | Meaning |
|---|---|
| `type: Any` | Adapted type. |
| `config: ConfigDict | None = None` | Adapter config. Not allowed for types with own config (`BaseModel`, `TypedDict`, dataclass); raises `type-adapter-config-unused`. |
| `_parent_depth: int = 2` | Stack depth for resolving forward annotations. Private/unstable. |
| `module: str | None = None` | Module passed to plugin if provided. |

Attributes:

| Attribute | Meaning |
|---|---|
| `core_schema` | Core schema for the adapted type. |
| `validator` | pydantic-core validator. |
| `serializer` | pydantic-core serializer. |
| `pydantic_complete` | Whether schema build is complete. |

Methods:

```python
def rebuild(
    self,
    *,
    force: bool = False,
    raise_errors: bool = True,
    _parent_namespace_depth: int = 2,
    _types_namespace: MappingNamespace | None = None,
) -> bool | None
```

```python
def validate_python(
    self,
    object: Any,
    *,
    strict: bool | None = None,
    extra: ExtraValues | None = None,
    from_attributes: bool | None = None,
    context: Any | None = None,
    experimental_allow_partial: bool | Literal['off', 'on', 'trailing-strings'] = False,
    by_alias: bool | None = None,
    by_name: bool | None = None,
) -> T
```

```python
def validate_json(
    self,
    data: str | bytes | bytearray,
    *,
    strict: bool | None = None,
    extra: ExtraValues | None = None,
    context: Any | None = None,
    experimental_allow_partial: bool | Literal['off', 'on', 'trailing-strings'] = False,
    by_alias: bool | None = None,
    by_name: bool | None = None,
) -> T
```

```python
def validate_strings(
    self,
    obj: Any,
    *,
    strict: bool | None = None,
    extra: ExtraValues | None = None,
    context: Any | None = None,
    experimental_allow_partial: bool | Literal['off', 'on', 'trailing-strings'] = False,
    by_alias: bool | None = None,
    by_name: bool | None = None,
) -> T
```

```python
def get_default_value(
    self,
    *,
    strict: bool | None = None,
    context: Any | None = None,
) -> Some[T] | None
```

```python
def dump_python(
    self,
    instance: T,
    *,
    mode: Literal['json', 'python'] = 'python',
    include: IncEx | None = None,
    exclude: IncEx | None = None,
    by_alias: bool | None = None,
    exclude_unset: bool = False,
    exclude_defaults: bool = False,
    exclude_none: bool = False,
    exclude_computed_fields: bool = False,
    round_trip: bool = False,
    warnings: bool | Literal['none', 'warn', 'error'] = True,
    fallback: Callable[[Any], Any] | None = None,
    serialize_as_any: bool = False,
    polymorphic_serialization: bool | None = None,
    context: Any | None = None,
) -> Any
```

```python
def dump_json(
    self,
    instance: T,
    *,
    indent: int | None = None,
    ensure_ascii: bool = False,
    include: IncEx | None = None,
    exclude: IncEx | None = None,
    by_alias: bool | None = None,
    exclude_unset: bool = False,
    exclude_defaults: bool = False,
    exclude_none: bool = False,
    exclude_computed_fields: bool = False,
    round_trip: bool = False,
    warnings: bool | Literal['none', 'warn', 'error'] = True,
    fallback: Callable[[Any], Any] | None = None,
    serialize_as_any: bool = False,
    polymorphic_serialization: bool | None = None,
    context: Any | None = None,
) -> bytes
```

```python
def json_schema(
    self,
    *,
    by_alias: bool = True,
    ref_template: str = DEFAULT_REF_TEMPLATE,
    union_format: Literal['any_of', 'primitive_type_array'] = 'any_of',
    schema_generator: type[GenerateJsonSchema] = GenerateJsonSchema,
    mode: JsonSchemaMode = 'validation',
) -> dict[str, Any]
```

```python
@staticmethod
def json_schemas(
    inputs: Iterable[tuple[JsonSchemaKeyT, JsonSchemaMode, TypeAdapter[Any]]],
    *,
    by_alias: bool = True,
    title: str | None = None,
    description: str | None = None,
    ref_template: str = DEFAULT_REF_TEMPLATE,
    union_format: Literal['any_of', 'primitive_type_array'] = 'any_of',
    schema_generator: type[GenerateJsonSchema] = GenerateJsonSchema,
) -> tuple[dict[tuple[JsonSchemaKeyT, JsonSchemaMode], JsonSchemaValue], JsonSchemaValue]
```

### Validation decorator

```python
def validate_call(
    func: AnyCallableT | None = None,
    *,
    config: ConfigDict | None = None,
    validate_return: bool = False,
) -> AnyCallableT | Callable[[AnyCallableT], AnyCallableT]
```
Validates function arguments and optionally the return value. Supports `@validate_call` and `@validate_call(...)` forms.

### Fields and model metadata

#### `FieldInfo`

Field metadata object used internally for every model/dataclass field. Do not instantiate or mutate directly except deliberate dynamic-model manipulation.

| Attribute | Meaning |
|---|---|
| `annotation` | Field type annotation. |
| `default` | Default value. |
| `default_factory` | Callable default factory, 0-arg or one-arg with validated data. |
| `alias` | Field alias. |
| `alias_priority` | Alias priority. |
| `validation_alias` | Validation alias: `str | AliasPath | AliasChoices | None`. |
| `serialization_alias` | Serialization alias. |
| `title` | JSON schema title. |
| `field_title_generator` | Callable to generate title. |
| `description` | JSON schema description. |
| `examples` | JSON schema examples. |
| `exclude` | Whether to exclude from serialization. |
| `exclude_if` | Callable deciding exclusion based on value. |
| `discriminator` | Discriminator field or `Discriminator`. |
| `deprecated` | Deprecation marker/message. |
| `json_schema_extra` | Extra JSON schema dict or callable. |
| `frozen` | Field-level immutability. |
| `validate_default` | Validate default values. |
| `repr` | Include in model repr. |
| `init` | Dataclass init inclusion. |
| `init_var` | Dataclass init-only variable. |
| `kw_only` | Dataclass keyword-only field. |
| `metadata` | Constraint/annotation metadata. |

Methods: `_construct`, `_from_dataclass_field`, `_collect_metadata`, `get_default`, `is_required`, `asdict`, `_copy`.

#### `Field()`

```python
def Field(
    default: Any = PydanticUndefined,
    *,
    default_factory: Callable[[], Any] | Callable[[dict[str, Any]], Any] | None = _Unset,
    alias: str | None = _Unset,
    alias_priority: int | None = _Unset,
    validation_alias: str | AliasPath | AliasChoices | None = _Unset,
    serialization_alias: str | None = _Unset,
    title: str | None = _Unset,
    field_title_generator: Callable[[str, FieldInfo], str] | None = _Unset,
    description: str | None = _Unset,
    examples: list[Any] | None = _Unset,
    exclude: bool | None = _Unset,
    exclude_if: Callable[[Any], bool] | None = _Unset,
    discriminator: str | Discriminator | None = _Unset,
    deprecated: Deprecated | str | bool | None = _Unset,
    json_schema_extra: JsonDict | Callable[[JsonDict], None] | None = _Unset,
    frozen: bool | None = _Unset,
    validate_default: bool | None = _Unset,
    repr: bool = _Unset,
    init: bool | None = _Unset,
    init_var: bool | None = _Unset,
    kw_only: bool | None = _Unset,
    pattern: str | Pattern[str] | None = _Unset,
    strict: bool | None = _Unset,
    coerce_numbers_to_str: bool | None = _Unset,
    gt: annotated_types.SupportsGt | None = _Unset,
    ge: annotated_types.SupportsGe | None = _Unset,
    lt: annotated_types.SupportsLt | None = _Unset,
    le: annotated_types.SupportsLe | None = _Unset,
    multiple_of: float | None = _Unset,
    allow_inf_nan: bool | None = _Unset,
    max_digits: int | None = _Unset,
    decimal_places: int | None = _Unset,
    min_length: int | None = _Unset,
    max_length: int | None = _Unset,
    union_mode: Literal['smart', 'left_to_right'] = _Unset,
    fail_fast: bool | None = _Unset,
) -> Any
```
Defines field defaults, aliases, schema metadata, validation/serialization behavior, numeric/string/collection constraints, union mode, and fail-fast behavior.

#### Private/computed fields

```python
def PrivateAttr(
    default: Any = PydanticUndefined,
    *,
    default_factory: Callable[[], Any] | None = None,
    init: Literal[False] = False,
) -> Any
```
Declares private attribute metadata. Raises if both `default` and `default_factory` are provided.

```python
def computed_field(
    func: PropertyT | None = None,
    /,
    *,
    alias: str | None = None,
    alias_priority: int | None = None,
    title: str | None = None,
    field_title_generator: Callable[[str, ComputedFieldInfo], str] | None = None,
    description: str | None = None,
    deprecated: Deprecated | str | bool | None = None,
    examples: list[Any] | None = None,
    json_schema_extra: JsonDict | Callable[[JsonDict], None] | None = None,
    repr: bool | None = None,
    return_type: Any = PydanticUndefined,
) -> PropertyT | Callable[[PropertyT], PropertyT]
```
Includes `property`/`cached_property` values in serialization and schema.

| Class | Public attributes/methods |
|---|---|
| `ModelPrivateAttr` | `default`, `default_factory`; `__getattr__`, `__set_name__`, `get_default()`. |
| `ComputedFieldInfo` | `decorator_repr`, `wrapped_property`, `return_type`, `alias`, `alias_priority`, `title`, `field_title_generator`, `description`, `deprecated`, `examples`, `json_schema_extra`, `repr`; `_update_from_config`, `_apply_alias_generator`. |

### Aliases

| Class | Attributes | Methods |
|---|---|---|
| `AliasPath` | `path: list[str | int]` | `convert_to_aliases() -> list[str | int]`; `search_dict_for_path(d: dict) -> Any`. |
| `AliasChoices` | `choices: list[str | AliasPath]` | `convert_to_aliases() -> list[list[str | int]]`. |
| `AliasGenerator` | `alias`, `validation_alias`, `serialization_alias` callables | `generate_aliases(field_name: str) -> tuple[str | None, str | AliasPath | AliasChoices | None, str | None]`. |

Alias generators:

```python
def to_pascal(snake: str) -> str
def to_camel(snake: str) -> str
def to_snake(camel: str) -> str
```

### Configuration

```python
class ConfigDict(TypedDict, total=False)
```
Model/type configuration dictionary. Use `model_config = ConfigDict(...)` on `BaseModel`, `config=ConfigDict(...)` on Pydantic dataclasses, or `__pydantic_config__ = ConfigDict(...)` on supported non-model types.

| Key | Values / purpose |
|---|---|
| `title` | JSON schema title. |
| `model_title_generator` | Callable model-title generator. |
| `field_title_generator` | Callable field-title generator. |
| `str_to_lower` | Convert strings to lowercase. |
| `str_to_upper` | Convert strings to uppercase. |
| `str_strip_whitespace` | Strip leading/trailing string whitespace. |
| `str_min_length` | Minimum length for string types. |
| `str_max_length` | Maximum length for string types. |
| `extra` | Extra input handling: `'ignore'` (default), `'forbid'`, `'allow'`. |
| `frozen` | Faux-immutable model; generates `__hash__` when possible. |
| `populate_by_name` | Legacy setting for population by field name; prefer `validate_by_name` + `validate_by_alias`. |
| `use_enum_values` | Populate models with enum values instead of enum objects. |
| `validate_assignment` | Validate on attribute assignment after creation. |
| `arbitrary_types_allowed` | Permit fields annotated with arbitrary classes; instance check only. |
| `from_attributes` | Build models and tagged-union discriminators from object attributes. |
| `loc_by_alias` | Use actual input key/alias in error locations. |
| `alias_generator` | Callable or `AliasGenerator` for automatic aliases. |
| `ignored_types` | Tuple of descriptor/custom ignored types allowed as unannotated class attrs. |
| `allow_inf_nan` | Permit `inf`, `-inf`, `nan` for float/decimal. |
| `json_schema_extra` | Dict/callable for extra JSON schema properties. |
| `json_encoders` | Deprecated V1 carryover custom encoders. |
| `strict` | Global strict validation. |
| `revalidate_instances` | Revalidate model/dataclass instances: `'never'`, `'always'`, `'subclass-instances'`. |
| `ser_json_timedelta` | Legacy timedelta JSON serialization mode. |
| `ser_json_temporal` | Temporal JSON serialization mode. |
| `val_temporal_unit` | Temporal numeric validation unit. |
| `ser_json_bytes` | Bytes JSON serialization mode. |
| `val_json_bytes` | Bytes JSON validation mode. |
| `ser_json_inf_nan` | Float infinity/NaN JSON serialization mode. |
| `validate_default` | Validate default values. |
| `validate_return` | Validate validator/call return values. |
| `protected_namespaces` | Namespaces that fields cannot conflict with. |
| `hide_input_in_errors` | Hide input value/type in errors. |
| `defer_build` | Defer schema validator/serializer build. |
| `plugin_settings` | Plugin-specific settings. |
| `schema_generator` | Deprecated/limited schema generator setting. |
| `json_schema_serialization_defaults_required` | Mark defaulted fields required in serialization schema. |
| `json_schema_mode_override` | Force validation/serialization schema mode. |
| `coerce_numbers_to_str` | Permit number-to-string coercion outside strict mode. |
| `regex_engine` | Pattern engine: Rust regex or Python `re`. |
| `validation_error_cause` | Attach underlying Python exception cause groups. |
| `use_attribute_docstrings` | Use attribute docstrings as field descriptions. |
| `cache_strings` | Cache strings during validation. |
| `validate_by_alias` | Permit validation by alias. |
| `validate_by_name` | Permit validation by field name. |
| `serialize_by_alias` | Serialize by alias by default. |
| `url_preserve_empty_path` | Preserve empty URL path. |
| `polymorphic_serialization` | Enable model/dataclass polymorphic serialization behavior. |

Other configuration exports:

```python
def with_config(config: ConfigDict | None = None, /, **kwargs: Any) -> Callable[[_TypeT], _TypeT]
ExtraValues = Literal['allow', 'ignore', 'forbid']
```

### Functional validators

Metadata validator classes for `typing.Annotated`:

| Class | Attributes / purpose |
|---|---|
| `AfterValidator` | `func`; run after inner validation. |
| `BeforeValidator` | `func`, `json_schema_input_type`; run before inner validation. |
| `PlainValidator` | `func`, `json_schema_input_type`; replace inner validation. |
| `WrapValidator` | `func`, `json_schema_input_type`; wrap inner validation with handler. |
| `InstanceOf[T]` | Validate input is an instance of `T`. |
| `SkipValidation[T]` | Skip validation for annotated type. |
| `ValidateAs(from_type, instantiation_hook)` | Validate via another type then transform. |

Decorator validators:

```python
def field_validator(
    field: str,
    /,
    *fields: str,
    mode: FieldValidatorModes = 'after',
    check_fields: bool | None = None,
    json_schema_input_type: Any = PydanticUndefined,
) -> Callable[[Any], Any]
```
Valid modes: `'before'`, `'after'`, `'plain'`, `'wrap'`. Must decorate class methods or functions accepted by Pydantic; bare `@field_validator` without field names is invalid.

```python
def model_validator(
    *,
    mode: Literal['wrap', 'before', 'after'],
) -> Any
```
Model-level validator. `'before'` sees raw input; `'after'` sees the model instance; `'wrap'` receives a handler.

Protocol/type aliases documented in this module:

| Name | Meaning |
|---|---|
| `ModelWrapValidatorHandler` | Handler passed to wrap model validators. |
| `ModelWrapValidatorWithoutInfo` | Wrap model validator callable without `ValidationInfo`. |
| `ModelWrapValidator` | Wrap model validator callable with `ValidationInfo`. |
| `FreeModelBeforeValidatorWithoutInfo` | Free before-model callable without info. |
| `ModelBeforeValidatorWithoutInfo` | Classmethod before-model callable without info. |
| `FreeModelBeforeValidator` | Free before-model callable with info. |
| `ModelBeforeValidator` | Classmethod before-model callable with info. |
| `ModelAfterValidatorWithoutInfo` | After-model callable without info. |
| `ModelAfterValidator` | After-model callable with info. |

### Functional serializers

Metadata serializer classes for `typing.Annotated`:

| Class | Attributes / purpose |
|---|---|
| `PlainSerializer` | `func`, `return_type`, `when_used`; replace serialization. |
| `WrapSerializer` | `func`, `return_type`, `when_used`; wrap serialization with handler. |
| `SerializeAsAny` | Annotated marker for duck-typed serialization. |

`when_used` accepted values: `'always'`, `'unless-none'`, `'json'`, `'json-unless-none'`.

Decorator serializers:

```python
def field_serializer(
    *fields: str,
    mode: Literal['plain', 'wrap'] = 'plain',
    return_type: Any = PydanticUndefined,
    when_used: WhenUsed = 'always',
    check_fields: bool | None = None,
) -> Callable[[Any], Any]
```

```python
def model_serializer(
    f: _ModelPlainSerializerT | _ModelWrapSerializerT | None = None,
    /,
    *,
    mode: Literal['plain', 'wrap'] = 'plain',
    when_used: WhenUsed = 'always',
    return_type: Any = PydanticUndefined,
) -> Any
```

Protocol/type aliases documented in this module:

| Name | Meaning |
|---|---|
| `FieldPlainSerializer` | Field plain serializer callable. |
| `FieldWrapSerializer` | Field wrap serializer callable. |
| `FieldSerializer` | Union of field serializer callables. |
| `ModelPlainSerializerWithInfo` | Model plain serializer with info. |
| `ModelPlainSerializerWithoutInfo` | Model plain serializer without info. |
| `ModelPlainSerializer` | Union of model plain serializer callables. |
| `ModelWrapSerializerWithInfo` | Model wrap serializer with info. |
| `ModelWrapSerializerWithoutInfo` | Model wrap serializer without info. |
| `ModelWrapSerializer` | Union of model wrap serializer callables. |

### JSON Schema

| Export | Purpose |
|---|---|
| `PydanticJsonSchemaWarning` | Warning emitted during schema generation. |
| `GenerateJsonSchema` | Customizable JSON Schema generator. |
| `WithJsonSchema` | Annotated marker to override JSON schema for a type. |
| `SkipJsonSchema` | Annotated marker to omit a field/type from JSON schema. |
| `model_json_schema` | Generate JSON schema for one model-like class. |
| `models_json_schema` | Generate schemas for multiple model-like classes. |
| `CoreSchemaOrFieldType` | Schema/field type alias. |
| `JsonSchemaValue` | JSON schema value alias. |
| `JsonSchemaMode` | `'validation' | 'serialization'`. |
| `JsonSchemaWarningKind` | Warning-kind alias. |
| `NoDefault` | Sentinel for no default. |
| `DEFAULT_REF_TEMPLATE` | Default `$ref` format template. |

`GenerateJsonSchema` attributes:

| Attribute | Meaning |
|---|---|
| `schema_dialect` | JSON Schema dialect; default is draft 2020-12. |
| `ignored_warning_kinds` | Warning kinds suppressed by `render_warning_message`. |
| `by_alias` | Use field aliases in schema generation. |
| `ref_template` | Reference-name template. |
| `core_to_json_refs` | Core ref to JSON ref map. |
| `core_to_defs_refs` | Core ref to definition ref map. |
| `defs_to_core_refs` | Definition ref to core ref map. |
| `json_to_defs_refs` | JSON ref to definition ref map. |
| `definitions` | Generated definitions. |

`GenerateJsonSchema` constructor:

```python
def __init__(
    self,
    by_alias: bool = True,
    ref_template: str = DEFAULT_REF_TEMPLATE,
    union_format: Literal['any_of', 'primitive_type_array'] = 'any_of',
) -> None
```

`GenerateJsonSchema` methods: `build_schema_type_to_method`, `generate_definitions`, `generate`, `generate_inner`, `sort`, `invalid_schema`, `any_schema`, `none_schema`, `bool_schema`, `int_schema`, `float_schema`, `decimal_schema`, `str_schema`, `bytes_schema`, `date_schema`, `time_schema`, `datetime_schema`, `timedelta_schema`, `literal_schema`, `missing_sentinel_schema`, `enum_schema`, `is_instance_schema`, `is_subclass_schema`, `callable_schema`, `list_schema`, `tuple_positional_schema`, `tuple_variable_schema`, `tuple_schema`, `set_schema`, `frozenset_schema`, `generator_schema`, `dict_schema`, `function_before_schema`, `function_after_schema`, `function_plain_schema`, `function_wrap_schema`, `default_schema`, `get_default_value`, `nullable_schema`, `union_schema`, `get_union_of_schemas`, `tagged_union_schema`, `chain_schema`, `lax_or_strict_schema`, `json_or_python_schema`, `typed_dict_schema`, `typed_dict_field_schema`, `dataclass_field_schema`, `model_field_schema`, `computed_field_schema`, `model_schema`, `resolve_ref_schema`, `model_fields_schema`, `field_is_present`, `field_is_required`, `dataclass_args_schema`, `dataclass_schema`, `arguments_schema`, `kw_arguments_schema`, `p_arguments_schema`, `get_argument_name`, `arguments_v3_schema`, `call_schema`, `custom_error_schema`, `json_schema`, `url_schema`, `multi_host_url_schema`, `uuid_schema`, `definitions_schema`, `definition_ref_schema`, `ser_schema`, `complex_schema`, `get_title_from_name`, `field_title_should_be_set`, `normalize_name`, `get_defs_ref`, `get_cache_defs_ref_schema`, `handle_ref_overrides`, `encode_default`, `update_with_validations`, `get_json_ref_counts`, `emit_warning`, `render_warning_message`.

```python
def model_json_schema(
    cls: type[BaseModel] | type[PydanticDataclass],
    by_alias: bool = True,
    ref_template: str = DEFAULT_REF_TEMPLATE,
    schema_generator: type[GenerateJsonSchema] = GenerateJsonSchema,
    mode: JsonSchemaMode = 'validation',
    union_format: Literal['any_of', 'primitive_type_array'] = 'any_of',
) -> dict[str, Any]
```

```python
def models_json_schema(
    models: Sequence[tuple[type[BaseModel] | type[PydanticDataclass], JsonSchemaMode]],
    *,
    by_alias: bool = True,
    title: str | None = None,
    description: str | None = None,
    ref_template: str = DEFAULT_REF_TEMPLATE,
    union_format: Literal['any_of', 'primitive_type_array'] = 'any_of',
    schema_generator: type[GenerateJsonSchema] = GenerateJsonSchema,
) -> tuple[dict[tuple[type[BaseModel] | type[PydanticDataclass], JsonSchemaMode], JsonSchemaValue], JsonSchemaValue]
```

### Error classes

| Class | Base / purpose |
|---|---|
| `ValidationError` | Imported from `pydantic_core`; raised on validation failures. |
| `PydanticErrorMixin` | Shared `message` and `code` behavior. |
| `PydanticUserError` | `RuntimeError`; incorrect Pydantic usage. |
| `PydanticUndefinedAnnotation` | `NameError`; unresolved annotation. Includes `name`, `message`, `from_name_error()`. |
| `PydanticImportError` | `ImportError`; import failed due to V1/V2 moves/removals. |
| `PydanticSchemaGenerationError` | `PydanticUserError`; core schema generation failure. |
| `PydanticInvalidForJsonSchema` | `PydanticUserError`; JSON schema cannot be generated for a core schema. |
| `PydanticForbiddenQualifier` | Forbidden type qualifier usage. |
| `PydanticDeprecatedSince20` / `26` / `29` / `210` / `211` / `212` | Deprecation warning classes for versioned removals. |

### Pydantic-specific and constrained types

#### Annotation metadata and helper classes

| Export | Purpose / attributes |
|---|---|
| `Strict` | Metadata: `strict: bool = True`. |
| `AllowInfNan` | Metadata: `allow_inf_nan: bool = True`. |
| `StringConstraints` | Metadata: `strip_whitespace`, `to_upper`, `to_lower`, `strict`, `min_length`, `max_length`, `pattern`, `ascii_only`. |
| `ImportString` | Validates/imports dotted import strings. |
| `UuidVersion` | Metadata: `uuid_version`. |
| `Json[T]` | Validates JSON string/bytes then validates contained type. |
| `Secret[T]` | Generic secret wrapper. |
| `SecretStr` | Secret string wrapper; masks display. |
| `SecretBytes` | Secret bytes wrapper; masks display. |
| `PaymentCardNumber` | Payment card validation; attrs/methods below. |
| `ByteSize` | Byte-size parser; methods below. |
| `PastDate` / `FutureDate` | Date constrained relative to current date. |
| `AwareDatetime` / `NaiveDatetime` | Datetime timezone-awareness constraints. |
| `PastDatetime` / `FutureDatetime` | Datetime constrained relative to current time. |
| `EncoderProtocol` | Protocol: `decode`, `encode`, `get_json_format`. |
| `Base64Encoder` | Standard base64 encoder. |
| `Base64UrlEncoder` | URL-safe base64 encoder. |
| `EncodedBytes` | Encoded bytes annotation; `decode`, `encode`. |
| `EncodedStr` | Encoded string annotation; `decode_str`, `encode_str`. |
| `GetPydanticSchema` | Annotation helper for custom schema hooks. |
| `Tag` | Tag marker for callable discriminators. |
| `Discriminator` | Tagged-union discriminator helper; `discriminator`, `custom_error_type`, `custom_error_message`, `custom_error_context`. |
| `FailFast` | Annotation marker to stop validation on first sequence item failure. |
| `OnErrorOmit` | Omit item on validation error when used in sequence annotations. |

`PaymentCardNumber` public members: `masked`; class/static validators `validate`, `validate_digits`, `validate_luhn_check_digit`, `validate_brand`.

`ByteSize` methods:

```python
def human_readable(self, decimal: bool = False, separator: str = '') -> str
def to(self, unit: str) -> float
```

#### Constrained factory functions

```python
def conint(*, strict: bool | None = None, gt: int | None = None, ge: int | None = None, lt: int | None = None, le: int | None = None, multiple_of: int | None = None) -> type[int]
def confloat(*, strict: bool | None = None, gt: float | None = None, ge: float | None = None, lt: float | None = None, le: float | None = None, multiple_of: float | None = None, allow_inf_nan: bool | None = None) -> type[float]
def conbytes(*, min_length: int | None = None, max_length: int | None = None, strict: bool | None = None) -> type[bytes]
def constr(*, strip_whitespace: bool | None = None, to_upper: bool | None = None, to_lower: bool | None = None, strict: bool | None = None, min_length: int | None = None, max_length: int | None = None, pattern: str | Pattern[str] | None = None) -> type[str]
def conset(item_type: type[HashableItemType], *, min_length: int | None = None, max_length: int | None = None) -> type[set[HashableItemType]]
def confrozenset(item_type: type[HashableItemType], *, min_length: int | None = None, max_length: int | None = None) -> type[frozenset[HashableItemType]]
def conlist(item_type: type[AnyItemType], *, min_length: int | None = None, max_length: int | None = None, unique_items: bool | None = None) -> type[list[AnyItemType]]
def condecimal(*, strict: bool | None = None, gt: int | Decimal | None = None, ge: int | Decimal | None = None, lt: int | Decimal | None = None, le: int | Decimal | None = None, multiple_of: int | Decimal | None = None, max_digits: int | None = None, decimal_places: int | None = None, allow_inf_nan: bool | None = None) -> type[Decimal]
def condate(*, strict: bool | None = None, gt: date | None = None, ge: date | None = None, lt: date | None = None, le: date | None = None) -> type[date]
```
Prefer `Annotated[..., Field(...)]` or `Annotated[..., annotated_types.*]` for new code when static type checking matters.

#### Strict/convenience aliases

| Type alias | Meaning |
|---|---|
| `StrictBool` | Boolean with strict validation. |
| `PositiveInt` | `int > 0`. |
| `NegativeInt` | `int < 0`. |
| `NonPositiveInt` | `int <= 0`. |
| `NonNegativeInt` | `int >= 0`. |
| `StrictInt` | Strict integer. |
| `PositiveFloat` | `float > 0`. |
| `NegativeFloat` | `float < 0`. |
| `NonPositiveFloat` | `float <= 0`. |
| `NonNegativeFloat` | `float >= 0`. |
| `StrictFloat` | Strict float. |
| `FiniteFloat` | Float excluding `nan` and infinities. |
| `StrictBytes` | Strict bytes. |
| `StrictStr` | Strict string. |
| `UUID1`, `UUID3`, `UUID4`, `UUID5`, `UUID6`, `UUID7`, `UUID8` | UUID version-constrained aliases. |
| `FilePath` | Path that exists and is a file. |
| `DirectoryPath` | Path that exists and is a directory. |
| `NewPath` | Path that does not exist. |
| `SocketPath` | Path that exists and is a socket. |
| `Base64Bytes` | Base64-encoded bytes alias. |
| `Base64Str` | Base64-encoded string alias. |
| `Base64UrlBytes` | URL-safe base64 bytes alias. |
| `Base64UrlStr` | URL-safe base64 string alias. |
| `JsonValue` | JSON-compatible recursive value alias. |

### Network types

| Export | Purpose / constraints |
|---|---|
| `UrlConstraints` | URL annotation metadata: `max_length`, `allowed_schemes`, `host_required`, `default_host`, `default_port`, `default_path`, `preserve_empty_path`. |
| `AnyUrl` | Any URL. |
| `AnyHttpUrl` | HTTP/HTTPS URL without TLD requirement. |
| `HttpUrl` | HTTP/HTTPS URL; max length 2083. |
| `AnyWebsocketUrl` | WebSocket URL without TLD requirement. |
| `WebsocketUrl` | WebSocket URL. |
| `FileUrl` | File URL. |
| `FtpUrl` | FTP URL. |
| `PostgresDsn` | PostgreSQL DSN; exposes `host`. |
| `CockroachDsn` | CockroachDB DSN; exposes `host`. |
| `AmqpDsn` | AMQP DSN. |
| `RedisDsn` | Redis DSN; exposes `host`. |
| `MongoDsn` | MongoDB DSN. |
| `KafkaDsn` | Kafka DSN. |
| `NatsDsn` | NATS DSN. |
| `MySQLDsn` | MySQL DSN. |
| `MariaDBDsn` | MariaDB DSN. |
| `ClickHouseDsn` | ClickHouse DSN. |
| `SnowflakeDsn` | Snowflake DSN; exposes `host`. |
| `EmailStr` | Email address type; requires optional `email-validator` dependency. |
| `NameEmail` | Name + email pair. |
| `IPvAnyAddress` | IPv4 or IPv6 address. |
| `IPvAnyInterface` | IPv4 or IPv6 interface. |
| `IPvAnyNetwork` | IPv4 or IPv6 network. |
| `MAX_EMAIL_LENGTH` | Maximum email length constant. |

```python
def validate_email(value: str) -> tuple[str, str]
```
Returns normalized name/email pair. Raises on invalid email. Requires `email-validator`.

### Supported standard-library annotation families

Pydantic validates/serializes the following standard-library families directly:

| Family | Types / constraints |
|---|---|
| Booleans | `bool`; accepts booleans, `0`/`1`, common true/false strings/bytes unless strict. `StrictBool` enforces bool only. |
| Strings | `str`; accepts strings, UTF-8 bytes/bytearray, enum values via `str()`, optional number-to-string coercion. Constraints: `pattern`, `min_length`, `max_length`, `strip_whitespace`, `to_upper`, `to_lower`, `ascii_only`. |
| Bytes | `bytes`; accepts bytes, strings, bytearray subject to `val_json_bytes`. Constraints: `min_length`, `max_length`. |
| Integers | `int`, `IntEnum`; constraints: `le`, `ge`, `lt`, `gt`, `multiple_of`. |
| Floats | `float`; constraints: `le`, `ge`, `lt`, `gt`, `multiple_of`, `allow_inf_nan`. |
| Decimal | `Decimal`; constraints: numeric bounds, `max_digits`, `decimal_places`, `multiple_of`, strictness. |
| Complex / Fraction | `complex`, `fractions.Fraction`; validation and serialization support. |
| Date/time | `datetime`, `date`, `time`, `timedelta`; constraints and strictness. |
| Enums | `Enum`, `IntEnum`, enum subclasses. |
| None | `None`, `NoneType`, `Literal[None]`. |
| Collections | `list`, `tuple`, `NamedTuple`, `set`, `frozenset`, `deque`, `Sequence`, `dict`, `TypedDict`, `Iterable`. Constraints include min/max length and fail-fast where supported. |
| Callable | `Callable`; validates callable-ness only, not signature. |
| IP | `IPv4Address`, `IPv6Address`, `IPv4Interface`, `IPv6Interface`, `IPv4Network`, `IPv6Network`. |
| UUID | `UUID`; constrained aliases `UUID1`...`UUID8`. |
| Type | `type[T]`; validates subclass. |
| Literals | `Literal[...]`; validates exact expected values. |
| Any | `Any`; accepts input as-is. |
| Hashable | `Hashable`; validates hashability. |
| Regex | `Pattern`; accepts compiled regex or parseable pattern string. |
| Paths | `Path` and path-like concrete subclasses; path constraints via Pydantic aliases. |

### Version and compatibility exports

```python
__version__: str
def version_info() -> str
```

V1 compatibility namespace:

```python
from pydantic.v1 import BaseModel as V1BaseModel
```
Pydantic V2 includes the latest V1 API under `pydantic.v1` for migration. Do not mix V1 models as fields inside V2 models or V2 models as fields inside V1 models.

Common V1 names encountered during migration:

| V1 name | V2 status / replacement |
|---|---|
| `BaseSettings` | Moved to `pydantic-settings`. |
| `Color`, `PaymentCardNumber` historical locations | Extra specialty types moved to `pydantic-extra-types` where applicable; `PaymentCardNumber` remains documented in `pydantic.types`. |
| `@validator` | Deprecated; use `@field_validator`. |
| `@root_validator` | Deprecated; use `@model_validator`. |
| `validate_arguments` | Renamed/deprecated; use `validate_call`. |
| `parse_obj_as` | Use `TypeAdapter(type).validate_python(value)`. |
| `parse_raw_as` | Use `TypeAdapter(type).validate_json(data)` for JSON. |
| `parse_file_as` | Load file then `TypeAdapter(...).validate_json()` / `validate_python()`. |
| `schema_of`, `schema_json_of` | Use `TypeAdapter(...).json_schema()` and serialize with `json.dumps`. |
| `__modify_schema__` | Removed; use `__get_pydantic_json_schema__`. |
| `Config` inner class | Deprecated; use `model_config = ConfigDict(...)`. |

## Setup & auth

Install with Python 3.9+:

```bash
python -m pip install -U pydantic
```

Conda:

```bash
conda install pydantic -c conda-forge
```

Install optional email validation support for `EmailStr` and `NameEmail`:

```bash
python -m pip install -U 'pydantic[email]'
```

Install from the upstream repository when testing unreleased changes:

```bash
python -m pip install 'git+https://github.com/pydantic/pydantic@main#egg=pydantic'
python -m pip install 'git+https://github.com/pydantic/pydantic@main#egg=pydantic[email]'
```

Related packages split from core Pydantic:

```bash
python -m pip install -U pydantic-settings
python -m pip install -U pydantic-extra-types
python -m pip install -U bump-pydantic
```

No auth, credentials, keyring entries, tokens, config files, or persistent state are required by Pydantic itself. Model behavior is configured in code via `model_config = ConfigDict(...)`, dataclass `config=...`, `TypeAdapter(..., config=...)` where allowed, or `__pydantic_config__` for supported external types. `pydantic-settings` is the separate package that reads environment variables, `.env` files, secrets directories, and CLI sources.

Verify installed versions:

```bash
python - <<'PY'
import pydantic
print(pydantic.__version__)
print(pydantic.version.version_info())
PY
```

## Common workflows

Define and validate a model:

```python
from pydantic import BaseModel, Field

class User(BaseModel):
    id: int
    name: str = Field(min_length=1)

user = User.model_validate({'id': '123', 'name': 'Ada'})
```

Output: `user.id` is `123` as an `int`; invalid input raises `ValidationError`.

Serialize with aliases and exclusions:

```python
from pydantic import BaseModel, Field

class User(BaseModel):
    user_id: int = Field(serialization_alias='id')
    password: str = Field(exclude=True)

user = User(user_id=1, password='secret')
payload = user.model_dump(by_alias=True)
json_payload = user.model_dump_json(by_alias=True)
```

Output: `payload == {'id': 1}` and secret field is omitted.

Validate arbitrary annotated types with `TypeAdapter`:

```python
from pydantic import TypeAdapter

adapter = TypeAdapter(list[int])
values = adapter.validate_python(['1', 2, 3])
json_bytes = adapter.dump_json(values)
schema = adapter.json_schema()
```

Output: `values == [1, 2, 3]`; `json_bytes` is a JSON byte string.

Add field and model validators:

```python
from pydantic import BaseModel, field_validator, model_validator

class Signup(BaseModel):
    email: str
    password: str
    password_confirm: str

    @field_validator('email')
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()

    @model_validator(mode='after')
    def passwords_match(self):
        if self.password != self.password_confirm:
            raise ValueError('passwords do not match')
        return self
```

Output: email is normalized; mismatched passwords raise `ValidationError`.

Generate JSON Schema for a model:

```python
from pydantic import BaseModel, Field

class Item(BaseModel):
    sku: str = Field(pattern=r'^[A-Z0-9-]+$')
    quantity: int = Field(ge=0)

schema = Item.model_json_schema()
```

Output: `schema` is a JSON Schema dictionary suitable for OpenAPI/schema tooling.

Migrate a V1 helper use to V2 `TypeAdapter`:

```python
from pydantic import TypeAdapter

# V1: parse_obj_as(list[int], value)
value = TypeAdapter(list[int]).validate_python(['1', '2'])
```

Output: `value == [1, 2]` without relying on deprecated V1 helpers.

## Error handling

| Symptom | Likely cause | Fix |
|---|---|---|
| `ValidationError` with `type=missing` | Required field absent. | Provide the field, set a default, or annotate as optional with a default such as `x: str | None = None`. |
| `ValidationError` with `type=int_type`, `type=string_type`, `type=list_type`, `type=dict_type`, or similar | Input type incompatible, especially in strict mode. | Use correct input type, remove strict mode, or add a `BeforeValidator`/`field_validator(mode='before')` to normalize. |
| `ValidationError` with `type=extra_forbidden` | `ConfigDict(extra='forbid')` and input contains unknown keys. | Remove keys, change config to `extra='ignore'` / `'allow'`, or validate with `extra='ignore'` override where appropriate. |
| `ValidationError` with `type=greater_than`, `greater_than_equal`, `less_than`, `less_than_equal`, or `multiple_of` | Numeric `Field()`/constraint metadata failed. | Adjust input or constraint (`gt`, `ge`, `lt`, `le`, `multiple_of`). |
| `ValidationError` with `type=json_invalid` | `model_validate_json()` / `TypeAdapter.validate_json()` received invalid JSON. | Parse/check JSON first or use `model_validate()` / `validate_python()` for Python objects. |
| `ValidationError` with `type=model_attributes_type` | `from_attributes=True` used but input is neither mapping nor object with needed attributes. | Pass a dict/model instance, or pass an object exposing matching attributes. |
| `ValidationError` with `type=is_instance_of` | `arbitrary_types_allowed=True` field received non-instance of the annotated arbitrary type. | Pass an instance of the exact type or implement custom schema/validator. |
| `ValidationError` with `type=url_scheme`, `url_syntax_violation`, `url_too_long`, or `url_type` | URL input violates network type constraints. | Use the required scheme/syntax/type; choose a broader URL type such as `AnyUrl` if constraints are too narrow. |
| `PydanticUserError` with `code == 'class-not-fully-defined'` | Forward reference target not yet defined when schema was built. | Define referenced class, then call `Model.model_rebuild()` or `TypeAdapter.rebuild()`. |
| `PydanticUserError` with `code == 'custom-json-schema'` | V1 `__modify_schema__` used. | Replace with `__get_pydantic_json_schema__(core_schema, handler)`. |
| `PydanticUserError` with `code == 'decorator-missing-arguments'` | Bare `@field_validator` or `@field_serializer` used without field names. | Use `@field_validator('field_name')` or `@field_serializer('field_name')`. |
| `PydanticUserError` with `code == 'model-field-missing-annotation'` | Model field assigned without type annotation. | Add an annotation, mark non-field as `ClassVar`, or configure `ignored_types`. |
| `PydanticUserError` with `code == 'model-field-overridden'` | Subclass overrides a base model field with an unannotated attribute. | Add a compatible annotation or rename the overriding class attribute. |
| `PydanticUserError` with `code == 'type-adapter-config-unused'` | `TypeAdapter(..., config=...)` used for a type that owns config (`BaseModel`, dataclass, `TypedDict`). | Put config on the type itself, e.g. `model_config` or `__pydantic_config__`. |
| `PydanticUserError` with `code == 'root-model-extra'` | `RootModel` configured with `model_config['extra']`. | Remove `extra`; `RootModel` cannot accept/store extra fields. |
| `PydanticSchemaGenerationError: Unable to generate pydantic-core schema for ...` | Unknown/arbitrary type lacks schema support. | Set `arbitrary_types_allowed=True` where supported, implement `__get_pydantic_core_schema__`, or adapt with custom validator/schema metadata. |
| `PydanticImportError` for moved V1 symbols | Import path changed between V1 and V2. | Use V2 replacement, `pydantic.v1` for temporary migration, `pydantic-settings` for `BaseSettings`, or `pydantic-extra-types` for moved specialty types. |
| `ImportError: email-validator is not installed` or email validation import failure | `EmailStr` / `NameEmail` used without optional dependency. | Install `python -m pip install 'pydantic[email]'` or `email-validator`. |
| `TypeError` or `PydanticUserError` from `validate_call` on class/property/callable instance | Unsupported target or invalid function signature. | Apply `@validate_call` to supported functions/methods with inspectable signatures. |

## Traps

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command when something bites._

## Lessons

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command for behaviors learned that aren't in upstream docs._
