# Infrastructure

Deployment and environment configuration for Correnthian.

Deliberately empty at Foundation v0.1. Nothing has been provisioned yet.

Expected contents as it fills in:

```
infrastructure/
├── docker/            local postgres + redis for development
├── terraform/         cloud resources, if not managed
└── environments/      per-environment overlays
```

## Note on credentials

This directory configures **Correnthian's own** secrets — provider API keys,
database credentials, encryption keys. It is categorically separate from user
wallet material, which never reaches Correnthian infrastructure at all.

No key material belongs in any environment file. CI enforces this.
