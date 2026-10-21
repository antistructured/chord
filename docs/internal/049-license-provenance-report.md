# Apache-2.0 Licensing & Provenance Report (Block 6C Pass 2)

## License Selection
- **Selected:** Apache License, Version 2.0 (confirmed by maintainer)
- **Applied to:** All first-party Chord source code in packages/core/src/
- **Status:** Applied in working tree

## Files
- `/LICENSE` - Apache-2.0 full text (root)
- `/packages/core/LICENSE` - Apache-2.0 full text (package)
- `/NOTICE` - Copyright notice (root): "Chord\nCopyright 2026 Antistructured Labs LLC"
- `/packages/core/NOTICE` - Copyright notice (package)
- `/packages/core/THIRD_PARTY_NOTICES.md` - Third-party attributions

## Copyright
**Claimed holder:** Antistructured Labs LLC  
**Year:** 2026  
**Basis:** Maintainer attestation (Chord entirely maintainer's project, no outside contributors). Recorded as attestation per instructions - not independently verified legal clearance.

## Provenance
- **Contributors:** None outside maintainer (per maintainer statement)
- **AI assistance:** Agents assisted under maintainer's direction
- **Git history:** 6 commits by weipertda <weipertda@gmail.com>
- **Vendored code:** None found
- **Copied third-party:** None identified in first-party source scan

## Dependencies
| Dependency | Version | License | Notes |
|------------|---------|---------|-------|
| @weipertda/sigiljs | 0.18.0 | MIT | Runtime dependency, npm package (not bundled). Documented in NOTICE and THIRD_PARTY_NOTICES.md. Apache-2.0 does not relicense this dependency. |

## Compliance Notes
- NOTICE files include attribution for Chord and note SigilJS dependency
- THIRD_PARTY_NOTICES.md contains full MIT license text for SigilJS
- package.json specifies `"license": "Apache-2.0"`
- All required license files included in package payload

## Attestation Record
Per maintainer: "Chord is entirely the maintainer's project. There are no outside contributors. AI agents assisted in development under the maintainer's direction." This is recorded as attestation as instructed; the requirement to identify copied third-party material, incompatible dependencies, or other provenance exceptions has been satisfied to the extent discoverable.
