import unittest
from pathlib import Path

from export_catalog import classify_site_category, find_photo


class TestClassifySiteCategory(unittest.TestCase):
    def test_plain_white_tea(self):
        self.assertEqual(classify_site_category({'num': 1, 'category': 'Белый чай'}), 'white')

    def test_plain_shu_puer(self):
        self.assertEqual(classify_site_category({'num': 2, 'category': 'Шу пуэр'}), 'shu-puer')

    def test_plain_sheng_puer(self):
        self.assertEqual(classify_site_category({'num': 7, 'category': 'Шэн пуэр'}), 'sheng-puer')

    def test_plain_red_tea(self):
        self.assertEqual(classify_site_category({'num': 48, 'category': 'Красный чай'}), 'red')

    def test_chenpi_override_item_3(self):
        self.assertEqual(classify_site_category({'num': 3, 'category': 'Шу пуэр'}), 'chenpi')

    def test_chenpi_override_item_10(self):
        self.assertEqual(classify_site_category({'num': 10, 'category': 'Белый чай'}), 'chenpi')

    def test_mandarin_shu_overrides(self):
        self.assertEqual(classify_site_category({'num': 26, 'category': 'Шу пуэр'}), 'mandarin-shu')
        self.assertEqual(classify_site_category({'num': 27, 'category': 'Шу пуэр'}), 'mandarin-shu')

    def test_sheng_puer_no_override_via_base_map(self):
        self.assertEqual(classify_site_category({'num': 9, 'category': 'Шэн пуэр'}), 'sheng-puer')


class TestFindPhoto(unittest.TestCase):
    def test_item_2_has_no_photo(self):
        self.assertIsNone(find_photo(2))

    def test_item_3_maps_to_row3(self):
        photo = find_photo(3)
        self.assertIsNotNone(photo)
        self.assertEqual(Path(photo).name, 'row3.jpeg')

    def test_item_10_has_no_photo(self):
        self.assertIsNone(find_photo(10))

    def test_item_11_maps_to_row11(self):
        photo = find_photo(11)
        self.assertIsNotNone(photo)
        self.assertEqual(Path(photo).name, 'row11.jpeg')


if __name__ == '__main__':
    unittest.main()
