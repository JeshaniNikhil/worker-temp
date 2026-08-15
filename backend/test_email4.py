from app.core.email_checker import check_email
print(check_email("abc.baza2@gmail.com, shop.abc.en@gmail.com"))
print(check_email("abc.baza2@gmail.com"))
print(check_email("abc.baza2@gmail.com; shop.abc.en@gmail.com"))
