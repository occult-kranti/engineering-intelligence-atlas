#!/usr/bin/env python3
"""Publish only reviewed CC-BY capture payloads and immutable conversion receipts.

Inputs are explicit local directories. Source acquisition and preserving conversion
run separately. This tool never downloads, repairs, simplifies or rescales a mesh.
"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / 'projects/architecture-library/site-models'
CC_BY = 'https://creativecommons.org/licenses/by/4.0/'

def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

def specs():
    shared = ['Exterior capture; complete interiors and concealed surfaces are not supplied.',
              'Physical scale, georeference and independent survey error are unverified.',
              'Captured vertex colour is not calibrated albedo or a complete PBR material.']
    credit = 'Rucha Shende, Sudhir Mudur, Tiberiu Popa and Kaustubha Mendhurwar, Heritage3DMtl, DOI 10.5281/zenodo.17063337, CC BY 4.0.'
    rows = [
      dict(id='st-george-antiochian-orthodox-church', name='St. George Antiochian Orthodox Church', shortName='St. George Church', location='Montreal, Canada', kind='Church / exterior capture', detailClass='dense-exterior', geometryClass='full-source-geometry', qualityLabel='Dense captured exterior', summary='A source-owner UAV photogrammetry mesh with captured vertex colour. The direct conversion retains every source triangle, including faces an earlier Blender import omitted.', appearance='Captured vertex RGB', attribution=credit, limitations=shared + ['The source MTL is absent; no image texture maps were invented.'], previewNote='Blender render of the inspected source exterior; the preview import omits 11 faces.', changes=['Direct OBJ to Float32 GLB conversion; source normals, RGB, triangle indices and coordinates retained.', 'Losslessly checked meshopt encoding; no decimation, scaling or generated detail.']),
      dict(id='el-markaz-islami-mosque', name='Islamic Center of Quebec — El Markaz Islami', shortName='El Markaz Islami Mosque', location='Montreal, Canada', kind='Mosque / exterior capture', detailClass='dense-exterior', geometryClass='full-source-geometry', qualityLabel='Dense captured exterior', summary='A dense source-owner photogrammetry capture of this named mosque. Retain its uneven exterior coverage and appearance; the model does not stand in for a different mosque.', appearance='Captured vertex RGB', attribution=credit, limitations=shared + ['The source MTL is absent; no image texture maps were invented.'], previewNote='Blender render of the inspected source exterior; the preview import omits 12 faces.', changes=['Direct OBJ to Float32 GLB conversion; source normals, RGB, triangle indices and coordinates retained.', 'Losslessly checked meshopt encoding; no decimation, scaling or generated detail.']),
      dict(id='kailasa-context', name='Kailasa Temple — exterior context', shortName='Kailasa / Cave 16', location='Ellora, Maharashtra, India', kind='Temple / context capture', detailClass='context', geometryClass='full-source-geometry', qualityLabel='Coarse context capture', summary='Actual-site exterior context showing the temple, courtyard and cut rock. This source is too coarse to support the requested carving-by-carving fidelity.', appearance='1024 px source texture', attribution='GSXNet / gsxn (embedded credit); Graphic solutions (current listing), Ellora Caves, through Objaverse / Zenodo 10269303, CC BY 4.0.', limitations=['Fine relief and complete interiors are not captured at the requested detail.', 'Scale, survey control, capture provenance and epoch remain unverified.', 'Separate Cave 16 carving references are not registered to this mesh.'], previewNote='Blender preview contains 136,498 triangles: the importer omitted 1 of the 136,499 triangles retained in the downloadable preserving GLB. Cause unverified; coarse relief is not enhanced.', changes=['Full supplied GLB geometry, image bytes and node transforms retained.', 'Compression decoded and compared against the supplied source document; no detail invented.']),
    ]
    for id, title, creator, summary in [
      ('khufu', 'Khufu — Great Pyramid', 'ianicolo', 'A recognizable site-specific pyramid and immediate ground, derived from video-based photogrammetry.'),
      ('khafre', 'Khafre Pyramid', 'pierre391', 'An individual pyramid derivative extracted from the credited plateau photogrammetry.'),
      ('menkaure', 'Menkaure Pyramid', 'PolarNick239', 'A site-specific pyramid derivative; the original creator reports perimeter photographs taken with a Realme XT.')]:
      rows.append(dict(id=id, name=title, shortName=title, location='Giza, Egypt', kind='Pyramid / processed context', detailClass='context', geometryClass='processed-context', qualityLabel='Processed context model', summary=summary, appearance='Source texture + colour', attribution=f'{creator}, original model; George Philippou, processed distribution at e89853b4351de608e908e30004d8c5860a0d83b5, CC BY 4.0.', limitations=['This supplied derivative was simplified, levelled and rescaled upstream.', 'No independently verified physical scale, stone-by-stone accuracy or interior coverage.', 'A pyramid silhouette does not certify complete masonry or terrain capture.'], previewNote='Blender render of the supplied processed model; captured gaps and low detail are retained.', changes=['Acquired processed GLB bytes preserved unchanged.', 'Decoded accessors, indices, texture bytes and transforms inspected; no claim about unavailable earlier masters.']))
    rows.append(dict(id='giza-plateau', name='Giza plateau — partial exterior', shortName='Giza plateau', location='Giza, Egypt', kind='Pyramids / context capture', detailClass='context', geometryClass='full-source-geometry', qualityLabel='Partial context capture', summary='Full supplied geometry from the inspected plateau GLB. It preserves a broader view, including clipped boundaries and holes, without becoming a controlled survey.', appearance='1024 px source texture', attribution='pierre391, Plateau de Gizeh, through Objaverse / Zenodo 10313356, CC BY 4.0.', limitations=['Peripheral terrain is clipped and holed; Menkaure coverage is cut at the boundary.', 'The source reports YouTube-based photogrammetry; capture control and underlying footage rights are unverified.', 'Texture detail is too coarse for stone-by-stone study; no verified interiors or metric dimensions.'], previewNote='Blender render of the acquired partial plateau mesh; clipped and missing terrain is retained.', changes=['All supplied GLB geometry, texture bytes and node transforms retained.', 'Losslessly checked compression only; no completion of missing structures.']))
    return rows

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--build-dir', type=Path, required=True)
    parser.add_argument('--preview-dir', type=Path, required=True)
    parser.add_argument('--acquisition-root', type=Path, required=True)
    args = parser.parse_args()
    pending = []
    for record in specs():
      id = record['id']; built = args.build_dir / id
      receipt_file = built / 'receipt.json'; receipt = json.loads(receipt_file.read_text())
      source = receipt['source']; output = receipt['output']['web']; file = built / output['file']
      if source['license'] != 'CC-BY-4.0' or not source.get('rightsReviewed'):
          raise ValueError('Model is not reviewed for the public collection')
      if file.stat().st_size != output['bytes'] or digest(file) != output['sha256']:
          raise ValueError(f'Wrong preserving output: {id}')
      if file.stat().st_size > 64 * 1024 * 1024:
          raise ValueError(f'Capture exceeds reviewed public per-file budget: {id}')
      checks = receipt['preservation']
      required = ['accessorBytesEqual', 'indexBytesAndCountsEqual', 'textureBytesEqual', 'materialPropertiesEqual',
                  'nodeTransformsEqual', 'hierarchyEqual', 'primitiveModesEqual', 'noDecimation', 'noQuantizeTransform', 'noLossyFilters']
      if any(checks.get(key) is not True for key in required):
          raise ValueError(f'Failed preservation gate: {id}')
      if source['format'] == 'glb' and checks.get('rawJSONTransformEquality') is not True:
          raise ValueError(f'Failed source GLB transform gate: {id}')
      if id in ['khufu', 'khafre', 'menkaure']:
          preview = args.preview_dir / id / 'preview.png'
          inspection = args.preview_dir / id / 'blender-inspection.json'
      elif id == 'kailasa-context':
          folder = args.acquisition_root / 'architecture-acquisition/kailasa-2026-11-25'
          preview = folder / 'ellora-local-preview.png'; inspection = folder / 'ellora-model-inspection.json'
      elif id == 'giza-plateau':
          preview = DESTINATION / 'research/giza/plateau-preview.png'
          inspection = DESTINATION / 'research/giza/blender-inspection.json'
      else:
          folder = args.acquisition_root / 'sacred-site-originals/acquired' / id / 'blender-verified'
          preview = folder / 'preview.png'; inspection = folder / 'blender-inspection.json'
      preview.resolve(strict=True); inspection.resolve(strict=True)
      record.update(file=f'assets/{id}.glb', preview=f'previews/{id}.png', evidence=f'evidence/{id}.json',
          triangles=receipt['sourceSnapshot']['totals']['triangles'], vertices=receipt['sourceSnapshot']['totals']['vertexEntries'],
          bytes=output['bytes'], sha256=output['sha256'], sourceUrl=source['url'],
          license={'spdx':'CC-BY-4.0', 'url':CC_BY, 'bundleStatus':'attribution-required', 'sourceRightsNote':source['rightsNote']},
          metric={'verified':False, 'units':None, 'measurementEnabled':False, 'crs':None, 'independentErrorMetres':None})
      public_receipt = json.loads(json.dumps(receipt))
      public_receipt['source']['path'] = Path(public_receipt['source']['path']).name
      public_receipt['previewInspection'] = json.loads(inspection.read_text())
      public_receipt['previewSha256'] = digest(preview)
      pending.append((record,file,preview,public_receipt))
    # All seven outputs and preview inputs pass before publication starts.
    for record,file,preview,receipt in pending:
      for name in [record['file'],record['preview'],record['evidence']]:
          (DESTINATION/name).parent.mkdir(parents=True,exist_ok=True)
      shutil.copyfile(file,DESTINATION/record['file']);shutil.copyfile(preview,DESTINATION/record['preview'])
      (DESTINATION/record['evidence']).write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
    references=[
      dict(id='klein-cave16',status='noncommercial-reference',label='CC BY-NC 4.0 / source only',name='Four Cave 16 carving captures',description='Arno Klein’s source-owner photogrammetry includes four explicitly named c16_ relief files, with 52,735–92,218 triangles per fragment and three 4096px images per file.',limitation='Separate cropped fragments; scale and whole-temple registration unverified. Acquired for research; excluded from the public game-asset payload.',url='https://zenodo.org/records/22163078'),
      dict(id='sidhu-kailasa',status='view-only',label='View only / download disabled',name='Sidhu’s Kailasa photogrammetry',description='The original public listing reports approximately 2.94 million faces, providing a denser view of the temple than the bundled context source.',limitation='The inspected API disables downloads and supplies no reuse license. A larger face count does not establish measured accuracy.',url='https://sketchfab.com/3d-models/kailasa-temple-at-ellora-c2d066f668034e1c893480e7f9190824'),
      dict(id='itek-kailasa',status='view-only',label='Viewing / evaluation only',name='iTek’s Kailasa splat capture',description='The creator reports 49 million splats and a 1.5 GB optimized scene. These are creator-reported figures; no local accuracy or performance validation was performed.',limitation='The sample policy requires separate permission for reuse. A splat scene is not automatically an editable mesh, collision surface or complete interior.',url='https://itek-media.com/gs/the_kailasa_temple/')]
    catalog={'schemaVersion':1,'edition':'2026-11-24','timezone':'America/New_York','metricVerifiedModels':0,'assets':[x[0] for x in pending],'references':references}
    (DESTINATION/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'models':len(pending),'modelBytes':sum(x[0]['bytes'] for x in pending),'triangles':sum(x[0]['triangles'] for x in pending),'metricVerified':0}))

if __name__=='__main__': main()
