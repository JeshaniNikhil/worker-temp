import redis
import os

r = redis.Redis(host='localhost', port=6379, db=0)
print("Keys in Redis:")
for key in r.keys():
    print(key)
    if r.type(key) == b'list':
        print(f"  Length: {r.llen(key)}")
