# DooPush Application Credentials

## Decision

- Every application has one stable, system-generated App Key.
- App Key is a public client bootstrap identifier and never grants server API permissions.
- Applications have zero or more user-created App Secrets.
- App Secrets are one-time-display bearer credentials with explicit scopes, optional expiry, independent revocation, and usage metadata.

## Trust boundaries

```text
App ID + App Key       -> register and operate a client device
App Secret + scopes   -> call server business APIs
Console JWT + RBAC    -> manage application resources
```

## Credential formats

```text
App Key             dp_ak_<random>
App Secret          dp_as_<random>
```

The prefix identifies DooPush and the credential type; it does not grant authority. Environments are isolated with separate applications rather than `live` or `test` credential prefixes.

## Scope enforcement

Every server API route declares fixed required scopes. Request-dependent behavior adds scopes after payload parsing; for example `target.type=all` additionally requires `push:broadcast`, and a scheduled request requires `push:schedule`.
