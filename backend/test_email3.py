import re
pattern = r"^[a-zA-Z0-9_.+-\/]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
print(bool(re.match(pattern, "abc.baza2@gmail.com")))
print(bool(re.match(pattern, "shop.abc.en@gmail.com")))
print(bool(re.match(pattern, "abc.baza2@gmail.com, shop.abc.en@gmail.com")))
