import asyncio
import random
import string
from core import db

async def generate_token(class_name: str, year: str = "2026") -> str:
    random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"{class_name}-{year}-{random_part}"

async def main():
    # Check classes without tokens
    classes_without_token = await db.classes.find({
        '$or': [
            {'token': {'$exists': False}},
            {'token': None},
            {'token': ''}
        ]
    }).to_list(1000)

    print(f"\nFound {len(classes_without_token)} classes without tokens")

    # Generate tokens for classes without them
    count = 0
    for cls in classes_without_token:
        token = await generate_token(cls['name'])
        result = await db.classes.update_one(
            {'_id': cls['_id']},
            {'$set': {'token': token}}
        )
        if result.modified_count > 0:
            count += 1
            print(f"  [OK] Generated token for {cls['name']}: {token}")

    print(f"\n[SUCCESS] Successfully generated {count} tokens")

    # Display all tokens
    all_classes = await db.classes.find({
        'token': {'$exists': True, '$ne': None}
    }).sort('name', 1).to_list(1000)

    print(f"\n[LIST] All classes with tokens ({len(all_classes)}):")
    for cls in all_classes:
        semester_id = cls.get('semester_id', 'N/A')
        print(f"  - {cls['name']:10s} | Token: {cls['token']:20s} | Semester: {semester_id}")

if __name__ == '__main__':
    asyncio.run(main())
