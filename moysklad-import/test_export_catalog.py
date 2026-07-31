import unittest
from export_catalog import classify_site_category


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

    def test_brick_stays_shu_puer(self):
        self.assertEqual(classify_site_category({'num': 9, 'category': 'Шу пуэр'}), 'shu-puer')


if __name__ == '__main__':
    unittest.main()
