# Exposed breast tissue views

The female viewer provides three chest views under **Chest detail**:

- **Tissue** retains the illustrative outer breast envelopes, with irregular lobulated adipose and connective-tissue surface shading.
- **Glands** removes the two outer envelopes to expose the existing mammary lobes, ducts, sinuses, and supports. Optional nipple surfaces are hidden by this preset.
- **Pectorals** hides the breast structures and enables the muscular layer so the underlying chest muscles can be inspected.

Search selection can reveal a hidden structure; isolation shows only selected structures. Explicit breast-layer controls restore Tissue mode. Reset restores the default Tissue view. The male model retains its previous visibility behavior and does not generate the breast surface textures.

The visual references are the user's [yoga illustration](https://as2.ftcdn.net/v2/jpg/15/60/68/51/1000_F_1560685187_zEMPM1N0EJRxhuaZdNMZYvFaaz7TCT7n.jpg) and [front/back anatomy illustration](https://as2.ftcdn.net/v2/jpg/14/70/93/01/1000_F_1470930188_f4Jov2p3B4BavIshxjOOmDtyqsGCGvyQ.jpg). The later [male/female comparison](https://as2.ftcdn.net/v2/jpg/00/43/97/89/1000_F_43978903_YzhmBhtc7BjKEc4wph42Gx3zpGTzdJn2.jpg) also shows lobulated yellow breast tissue. The [Sketchfab écorché reference](https://sketchfab.com/3d-models/ecorche-female-musclenames-anatomy-cda17af4be354c8b8375ff0b1b8a5fe5), inspected in its interactive viewer from frontal and oblique/profile angles, shows exposed pectoral muscles with breast tissue removed. These correspond to different tissue layers, which the controls keep distinct. They guide appearance only. No reference-image pixels or Sketchfab geometry are distributed as assets.

The surface detail is procedurally illustrated, not measured lobule boundaries or muscle-fiber directions. It changes shading, not the source mesh positions or breast contour. Breast glandular, adipose, and connective tissues overlie pectoralis major; they should not be taught as another skeletal muscle. See the [NCI SEER mammary gland overview](https://training.seer.cancer.gov/anatomy/reproductive/female/glands.html).

The underlying breast assembly still has the placement limitations recorded in [the containment audit](breast-containment-audit.md). Exposing an internal structure does not validate its registration. Current proportions and surface detail remain an estimated study model, not a validated teaching atlas.

Visibility regression checks:

```bash
node --experimental-strip-types --test scripts/chest-visibility.test.mjs
```
