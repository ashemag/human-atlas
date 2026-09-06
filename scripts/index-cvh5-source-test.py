import importlib.util
import struct
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('cvh5_index', Path(__file__).with_name('index-cvh5-source.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def string(value):
    data = value.encode('utf-8')
    return struct.pack('<H', len(data)) + data


def block(kind, data):
    return struct.pack('<III', kind, len(data), 0) + data + b'\0' * ((-len(data)) % 4)


def modifier(name, kind, children):
    prefix = string(name) + struct.pack('<II', kind, 0)
    prefix += b'\0' * ((-len(prefix)) % 4)
    return block(0xffffff14, prefix + struct.pack('<I', len(children)) + b''.join(children))


def fixture(resource='resource'):
    header = block(0x00443355, b'')
    group = modifier('root', 0, [block(0xffffff21, string('root') + struct.pack('<I', 0))])
    node_data = string('Urethral layer') + struct.pack('<I', 1) + string('root') + struct.pack('<16f', *([1] * 16)) + string(resource) + struct.pack('<I', 3)
    model = modifier('Urethral layer', 0, [block(0xffffff22, node_data)])
    geometry = modifier('resource', 1, [block(0x100, b'opaque extension-compressed geometry')])
    return header + group + model + geometry


class SceneIndexTests(unittest.TestCase):
    def test_groups_are_not_geometry_and_model_references_remain_explicit(self):
        report = module.index_u3d(fixture())
        self.assertEqual((report['groupCount'], report['modelNodeCount'], report['resourceCount']), (1, 1, 1))
        self.assertNotIn('resource', report['nodes'][0])
        self.assertEqual(report['nodes'][1]['resource'], 'resource')
        self.assertEqual(report['resources'][0]['declarations'][0]['blockType'], '0x100')
        self.assertNotIn('triangleCount', report['resources'][0])

    def test_missing_referenced_geometry_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'missing geometry'):
            module.index_u3d(fixture('nonexistent'))

    def test_truncated_blocks_and_wrong_magic_are_rejected(self):
        for data in [fixture()[:-7], block(123, b'')]:
            with self.assertRaises(ValueError):
                module.index_u3d(data)

    def test_utf8_source_names_and_trailing_spaces_are_preserved(self):
        self.assertEqual(module.Reader(string('Bartholin’s gland ')).string(), 'Bartholin’s gland ')


if __name__ == '__main__':
    unittest.main()
