# /scripts — Utilities

| Script | Purpose |
| --- | --- |
| (placeholder) `seed.py` | Backend `app/seed.py` already seeds categories, products, PINs, demo accounts on first boot — kept here as the canonical seeder. |
| (planned) `migrate_*.py` | Add MongoDB migration scripts here as the schema evolves. |
| (planned) `bulk_pins.csv` | Example PIN-code CSV for the bulk-import flow at `/admin/pincodes`. |

## Running the seeder manually
The seeder runs automatically on backend startup. To force a re-seed locally:

```bash
docker compose exec mongodb mongosh vfast_marketplace --eval "db.products.drop(); db.categories.drop(); db.banners.drop();"
docker compose restart backend
```

## Example CSVs
Place CSV files used by the admin CSV importers in this directory so the team has reference templates. The expected headers are documented in
`/docs/TECHNICAL_PLAYBOOK.md`.
