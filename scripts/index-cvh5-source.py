"""Passively extract the pinned CVH5 PDF's U3D data and index its scene declarations.

Requires pypdf for PDF extraction only. Never opens a PDF viewer, runs JavaScript,
loads extension plugins, or interprets geometry payloads as executable content.
The scene index uses ECMA-363 section 9 block, chain and node declarations.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def sha(data):
    return hashlib.sha256(data).hexdigest()


class Reader:
    def __init__(self, data):
        self.data, self.pos = data, 0

    def take(self, n):
        if n < 0 or self.pos + n > len(self.data):
            raise ValueError('Truncated U3D declaration')
        result = self.data[self.pos:self.pos + n]
        self.pos += n
        return result

    def number(self, fmt):
        return struct.unpack('<' + fmt, self.take(struct.calcsize('<' + fmt)))[0]

    def string(self):
        return self.take(self.number('H')).decode('utf-8').rstrip('\0')

    def align(self):
        padding = self.take((-self.pos) % 4)
        if any(padding):
            raise ValueError('Nonzero U3D padding')


def blocks(data):
    r = Reader(data)
    while r.pos < len(data):
        offset = r.pos
        kind, size, metadata_size = struct.unpack('<III', r.take(12))
        payload = r.take(size)
        r.align()
        r.take(metadata_size)
        r.align()
        yield offset, kind, payload


def chain(payload):
    r = Reader(payload)
    name, kind, flags = r.string(), r.number('I'), r.number('I')
    if flags & ~3:
        raise ValueError('Unsupported modifier chain flags')
    if flags & 1:
        r.take(16)
    if flags & 2:
        r.take(24)
    r.align()
    count = r.number('I')
    children = list(blocks(r.take(len(payload) - r.pos)))
    if len(children) != count:
        raise ValueError('Modifier count does not match declaration blocks')
    return name, kind, children


def node(payload, kind):
    r = Reader(payload)
    name = r.string()
    parents = []
    for _ in range(r.number('I')):
        parent = r.string()
        matrix = list(struct.unpack('<16f', r.take(64)))
        parents.append({'name': parent, 'matrix': matrix})
    result = {'id': name, 'name': name, 'kind': 'model' if kind == 0xffffff22 else 'group', 'parents': parents}
    if kind == 0xffffff22:
        result['resource'] = r.string()
        result['visibility'] = r.number('I')
    if r.pos != len(payload):
        raise ValueError('Unparsed node declaration data')
    return result


def extension(payload):
    import uuid
    r = Reader(payload)
    name, kind = r.string(), r.number('I')
    guid = str(uuid.UUID(bytes_le=r.take(16)))
    declaration = r.number('I')
    continuation = [hex(r.number('I')) for _ in range(r.number('I'))]
    vendor = r.string()
    urls = [r.string() for _ in range(r.number('I'))]
    information = r.string()
    return {'name': name, 'modifierType': kind, 'guid': guid, 'declarationBlockType': hex(declaration), 'continuationBlockTypes': continuation, 'vendor': vendor, 'informationUrls': urls, 'information': information}


def index_u3d(data):
    top = list(blocks(data))
    if not top or top[0][1] != 0x00443355:
        raise ValueError('Not a U3D stream')
    nodes, resources, extensions = [], [], []
    counts = {}
    for offset, kind, payload in top:
        counts[hex(kind)] = counts.get(hex(kind), 0) + 1
        if kind != 0xffffff14:
            continue
        name, chain_kind, children = chain(payload)
        for child_offset, child_kind, child in children:
            if child_kind in (0xffffff21, 0xffffff22):
                parsed = node(child, child_kind)
                if parsed['name'] != name or chain_kind != 0:
                    raise ValueError('Node/chain identity mismatch')
                nodes.append(parsed)
            if child_kind == 0xffffff16:
                extensions.append(extension(child))
        if chain_kind == 1:
            resources.append({'id': name, 'kind': 'geometry-resource', 'chainOffset': offset, 'declarations': [{'blockType': hex(k), 'bytes': len(b), 'sha256': sha(b)} for _, k, b in children]})
    resource_ids = {r['id'] for r in resources}
    if len(resource_ids) != len(resources) or len({n['id'] for n in nodes}) != len(nodes):
        raise ValueError('Duplicate resource or node identity')
    for n in nodes:
        if n['kind'] == 'model' and n['resource'] not in resource_ids:
            raise ValueError('Model references a missing geometry resource')
    return {'schemaVersion': 1, 'u3dSha256': sha(data), 'u3dBytes': len(data), 'groupCount': sum(n['kind'] == 'group' for n in nodes), 'modelNodeCount': sum(n['kind'] == 'model' for n in nodes), 'resourceCount': len(resources), 'nodes': nodes, 'resources': resources, 'extensions': extensions, 'topLevelBlockCounts': counts, 'limits': 'Passive declaration index only. Group nodes do not imply geometry. Model nodes refer to source resources; their extension-compressed triangle payloads have not been decoded, anatomically validated, or imported.'}


def extract_pdf(pdf, pins):
    from pypdf import PdfReader
    data = pdf.read_bytes()
    matches = [p for p in pins['pdfSources'] if p['sha256'] == sha(data)]
    if not matches:
        raise ValueError('PDF checksum is not in the pinned source list')
    reader = PdfReader(pdf)
    streams = []
    for page in reader.pages:
        for ref in page.get('/Annots', []):
            annotation = ref.get_object()
            if annotation.get('/Subtype') == '/3D':
                stream = annotation['/3DD'].get_object()
                if stream.get('/Subtype') != '/U3D':
                    raise ValueError('Expected U3D annotation data')
                streams.append(stream.get_data())
    if len(streams) != 1 or sha(streams[0]) != pins['u3d']['sha256']:
        raise ValueError('Expected exactly one pinned U3D stream')
    return streams[0]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf', type=Path)
    parser.add_argument('--u3d-output', required=True, type=Path)
    parser.add_argument('--index-output', required=True, type=Path)
    args = parser.parse_args()
    pins = json.loads((ROOT / 'data/anatomy/cvh5/provenance.json').read_text())
    data = extract_pdf(args.pdf, pins)
    report = index_u3d(data)
    for destination in [args.u3d_output, args.index_output]:
        destination.parent.mkdir(parents=True, exist_ok=True)
    args.u3d_output.write_bytes(data)
    args.index_output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(f"Indexed {report['modelNodeCount']} model nodes, {report['groupCount']} groups, {report['resourceCount']} resources; triangle decoding remains separate.")


if __name__ == '__main__':
    main()
