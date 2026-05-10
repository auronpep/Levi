---
name: tool-tomli
description: Load when working with tomli, tomllib, TOML parsing, pyproject.toml reads, parse_float, or TOMLDecodeError. Covers full API surface, compatibility setup, error handling, and lessons.
triggers:
  bash: []
---

# tomli / tomllib

## What it is

**Assumption:** identifier `tomli / tomllib` interpreted as Tomli (`hukkin/tomli`) and Python's standard-library `tomllib`; Levi skill path remains `skills/tools/tomli/SKILL.md` because the architecture initial scope names `tomli`. Tomli is a Python library for parsing TOML documents into plain Python data structures. `tomllib` is the Python 3.11+ standard-library counterpart. Reach for `tomllib` on Python 3.11+ when stdlib-only parsing is enough; use `tomli` as a backport or for current Tomli parser behavior on supported Python versions. Alternatives: `tomli-w` for writing and `tomlkit` for style-preserving read/write.

## Capability surface

No CLI surface. `triggers.bash: []`; this pure-library skill loads explicitly only until Levi adds Python-import trigger enforcement.

### Runtime/import matrix

| Runtime/package | Import name | TOML grammar | Install state | Notes |
|---|---|---|---|---|
| Python 3.11-3.14 stdlib | `tomllib` | TOML 1.0.0 | Built in | Read-only parser. No `dumps`, `dump`, `write`, or encode API. |
| Python 3.15+ stdlib | `tomllib` | TOML 1.1.0 | Built in | 1.1 changes are backwards-compatible for valid TOML 1.0.0 documents. |
| Tomli 2.4.0+ | `tomli` | TOML 1.1.0 | `pip install tomli` | Backport/current parser package. |
| Tomli < 2.4.0 | `tomli` | TOML 1.0.0 | Version-pinned dependency | Older releases remain TOML 1.0.0-compatible. |

### Public API: `tomli`

`tomli.__all__ = ("loads", "load", "TOMLDecodeError")`

| Symbol | Signature / type | Purpose |
|---|---|---|
| `tomli.load` | `load(fp, /, *, parse_float=float) -> dict[str, Any]` | Parse TOML from a readable binary file object. |
| `tomli.loads` | `loads(s, /, *, parse_float=float) -> dict[str, Any]` | Parse TOML from a `str` object. |
| `tomli.TOMLDecodeError` | `TOMLDecodeError(msg, doc, pos)` | `ValueError` subclass raised for invalid TOML. |
| `tomli.__version__` | `str` | Package version string; not part of `__all__`. |

### Public API: `tomllib`

`tomllib.__all__ = ("loads", "load", "TOMLDecodeError")`

| Symbol | Signature / type | Purpose |
|---|---|---|
| `tomllib.load` | `load(fp, /, *, parse_float=float) -> dict[str, Any]` | Parse TOML from a readable binary file object. |
| `tomllib.loads` | `loads(s, /, *, parse_float=float) -> dict[str, Any]` | Parse TOML from a `str` object. |
| `tomllib.TOMLDecodeError` | `TOMLDecodeError(msg, doc, pos)` in Python 3.14+ | `ValueError` subclass raised for invalid TOML. |

### `load(fp, /, *, parse_float=float)`

| Parameter | Accepted value | Behavior |
|---|---|---|
| `fp` | Readable binary file object | Reads bytes, decodes as UTF-8, and parses as TOML. Open TOML files with `"rb"`. Positional-only. |
| `parse_float` | Callable receiving each TOML float as a string | Defaults to `float(num_str)`. Use `decimal.Decimal` or another scalar-producing callable for exact numeric handling. Must not return `dict`, `list`, or their subtypes. Keyword-only. |

Returns: `dict[str, Any]` populated with builtin types and standard-library date/time types.

Raises:

| Exception | Condition |
|---|---|
| `TOMLDecodeError` | Invalid TOML document. |
| `TypeError` | Text-mode file object or otherwise invalid file-like object. |
| `ValueError` | `parse_float` returns a forbidden `dict`/`list` value. |
| `RecursionError` | Pathologically nested inline arrays/tables or excessive key parts exceed parser recursion limits. |

### `loads(s, /, *, parse_float=float)`

| Parameter | Accepted value | Behavior |
|---|---|---|
| `s` | `str` | Parses TOML from an in-memory Unicode string. Positional-only. |
| `parse_float` | Callable receiving each TOML float as a string | Same semantics as `load()`. Keyword-only. |

Returns: `dict[str, Any]` populated with builtin types and standard-library date/time types.

Raises:

| Exception | Condition |
|---|---|
| `TOMLDecodeError` | Invalid TOML document. |
| `TypeError` | `s` is not a `str`; bytes belong in `load()` with a binary stream or must be decoded first. |
| `ValueError` | `parse_float` returns a forbidden `dict`/`list` value. |
| `RecursionError` | Pathologically nested inline arrays/tables or excessive key parts exceed parser recursion limits. |

### `TOMLDecodeError`

| Runtime | Constructor / attributes |
|---|---|
| Tomli 2.1.0+ | `TOMLDecodeError(msg, doc, pos)`; attributes `msg`, `doc`, `pos`, `lineno`, `colno`. Free-form positional arguments are deprecated. |
| Python 3.14+ `tomllib` | `TOMLDecodeError(msg, doc, pos)`; attributes `msg`, `doc`, `pos`, `lineno`, `colno`. Free-form positional arguments are deprecated. |
| Python 3.11-3.13 `tomllib` | `ValueError` subclass raised for invalid TOML; do not rely on newer location attributes. |

Catch from the chosen parser alias:

```python
try:
    data = tomllib.loads(src)
except tomllib.TOMLDecodeError as exc:
    ...
```

Tomli documents parser error messages as informational only; do not assert exact message text in tests unless the test is version-pinned.

### TOML-to-Python conversion table

| TOML type | Python type |
|---|---|
| TOML document | `dict` |
| Key | `str` |
| String | `str` |
| Integer | `int` |
| Float | `float` by default; configurable with `parse_float` |
| Boolean | `bool` |
| Offset date-time | `datetime.datetime` with `tzinfo` set to a `datetime.timezone` instance |
| Local date-time | `datetime.datetime` with `tzinfo` set to `None` |
| Local date | `datetime.date` |
| Local time | `datetime.time` |
| Array | `list` |
| Table | `dict` |
| Inline table | `dict` |
| Array of tables | `list[dict]` |

### TOML 1.1.0 syntax deltas to recognize

| TOML 1.1.0 change | Example shape |
|---|---|
| Newlines in inline tables | `tbl = {\n  key = "value",\n}` |
| Trailing commas in inline tables | `tbl = { key = 1, }` |
| `\xHH` escape in basic strings for codepoints under 255 | `"letter a: \x61"` |
| `\e` escape for escape character | `"csi = \e["` |
| Optional seconds in datetime/time values | `dt = 2010-02-03 14:15`; `t = 14:15` |

### Limits and non-features

| Feature | Status | Replacement |
|---|---|---|
| CLI | None | Import from Python. |
| Writing TOML | Not supported by `tomli`/`tomllib` | `tomli-w` (`dump`, `dumps`). |
| Comment/style preservation | Not supported; parser returns plain data | `tomlkit`. |
| Mutable parsed config model | Not provided | Validate/transform the returned `dict`, or use a style-preserving TOML library. |
| Auth/session/config state | None | No credentials, cache, or config files. |
| Untrusted input hardening | No built-in size limit | Limit input size before parsing. |

## Setup & auth

Install paths:

```bash
python -m pip install tomli
```

Project dependency for stdlib-first compatibility on Python versions before 3.11:

```toml
[project]
dependencies = [
  "tomli >= 1.1.0 ; python_version < '3.11'",
]
```

Project dependency for TOML 1.1.0 parsing on Python versions whose stdlib `tomllib` is still TOML 1.0.0-only:

```toml
[project]
dependencies = [
  "tomli >= 2.4.0 ; python_version < '3.15'",
]
```

Runtime fallback import:

```python
import sys

if sys.version_info >= (3, 11):
    import tomllib
else:
    import tomli as tomllib
```

Alternative import that works under dependency-injection tests:

```python
try:
    import tomllib
except ModuleNotFoundError:
    import tomli as tomllib
```

Credentials: none.

State locations: none. `tomli` installs into the active Python environment's `site-packages`; `tomllib` lives in the Python standard library.

Platform notes:

| Platform/runtime | Note |
|---|---|
| CPython | Tomli publishes mypyc-generated binary wheels for common platforms and pure-Python wheels elsewhere. |
| PyPy | Use the pure-Python wheel. |
| Windows ARM64 | Tomli 2.4.0+ added binary wheels. |
| Python < 3.8 | Current Tomli releases require Python >= 3.8. Use an older Tomli release only when maintaining EOL Python. |

## Common workflows

Parse `pyproject.toml` with stdlib `tomllib`:

```python
import tomllib

with open("pyproject.toml", "rb") as f:
    data = tomllib.load(f)
```

Output / side effect: returns a nested `dict`; file handle is consumed.

Parse a TOML string:

```python
import tomllib

src = """
python-version = "3.11.0"
python-implementation = "CPython"
"""
data = tomllib.loads(src)
```

Output / side effect: returns `{"python-version": "3.11.0", "python-implementation": "CPython"}`.

Use one parser name across Python versions:

```python
import sys

if sys.version_info >= (3, 11):
    import tomllib
else:
    import tomli as tomllib

with open("config.toml", "rb") as f:
    config = tomllib.load(f)
```

Output / side effect: uses stdlib on Python 3.11+ and Tomli on older supported Python versions.

Parse TOML floats as `decimal.Decimal`:

```python
from decimal import Decimal
import tomllib

data = tomllib.loads("precision = 0.982492", parse_float=Decimal)
assert isinstance(data["precision"], Decimal)
```

Output / side effect: TOML floats become `Decimal` instances instead of binary floats.

Handle invalid TOML:

```python
import tomllib

try:
    data = tomllib.loads("]] this is invalid TOML [[")
except tomllib.TOMLDecodeError as exc:
    message = str(exc)
```

Output / side effect: parse failures are caught as parser-specific `TOMLDecodeError`.

## Error handling

| Symptom | Likely cause | Fix |
|---|---|---|
| `TypeError: File must be opened in binary mode, e.g. use \`open('foo.toml', 'rb')\`` | `load()` received a text-mode file object or object returning `str` instead of `bytes`. | Open files with `open(path, "rb")`; use `loads()` for strings. |
| `TypeError: Expected str object, not 'bytes'` | `loads()` received `bytes`. | Decode to `str` first, or wrap bytes in a binary stream and call `load()`. |
| `ValueError` from `parse_float` | `parse_float` returned `dict`, `list`, or a subtype. | Return a scalar/object type such as `decimal.Decimal`. |
| `TOMLDecodeError: Cannot overwrite a value` | A key or namespace is defined twice, or a scalar is later treated as a table. | Remove duplicate assignments; separate scalar keys from table declarations. |
| `TOMLDecodeError: Cannot declare ... twice` | Same table declared more than once where TOML forbids redeclaration. | Merge table contents into one declaration or use arrays of tables with `[[...]]`. |
| `TOMLDecodeError: Expected '=' after a key in a key/value pair` | Key/value assignment missing `=`. | Use `key = value` syntax. |
| `TOMLDecodeError: Unescaped '\\' in a string` | Invalid escape in a basic string. | Escape backslashes as `\\` or use a TOML literal string where appropriate. |
| `TOMLDecodeError: Invalid hex value` | `\x`, `\u`, or `\U` escape has missing or non-hex digits. | Supply the required number of hexadecimal digits. |
| `TOMLDecodeError: Escaped character is not a Unicode scalar value` | Unicode escape names a surrogate or otherwise invalid scalar value. | Replace with a valid Unicode scalar value. |
| `RecursionError: TOML key has more than the allowed ... parts` | TOML key has excessive dotted-key depth. | Reject/limit untrusted input size and key depth before parsing. |
| TOML 1.1 inline table parses on Python 3.15+/Tomli 2.4+ but fails on Python 3.11-3.14 `tomllib` | Grammar mismatch: TOML 1.1.0 syntax used with TOML 1.0.0 parser. | Use Tomli >= 2.4.0 consistently, or keep files valid TOML 1.0.0 for Python 3.11-3.14 stdlib parsers. |

## Traps

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command when something bites._

## Lessons

_Append-only. Date-stamped. Filled by the operator via the `/lesson` slash command for behaviors learned that aren't in upstream docs._
