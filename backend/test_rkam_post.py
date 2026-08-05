"""Test RKAM POST endpoint to debug save issue"""
import asyncio
import httpx
import json
import sys

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

async def test_rkam_post():
    base_url = "http://127.0.0.1:8000/api"

    # Step 1: Get captcha
    print("=" * 60)
    print("STEP 1: Get captcha")
    print("=" * 60)

    async with httpx.AsyncClient() as client:
        try:
            # Get captcha
            captcha_response = await client.get(
                f"{base_url}/auth/captcha",
                timeout=10.0
            )

            if captcha_response.status_code != 200:
                print(f"❌ Captcha failed: {captcha_response.status_code}")
                return

            captcha_data = captcha_response.json()
            captcha_id = captcha_data['challenge_id']
            captcha_question = captcha_data['question']
            # Extract numbers from "Berapa 19 - 2 = ?"
            import re
            numbers = re.findall(r'\d+', captcha_question)
            if '+' in captcha_question:
                captcha_answer = int(numbers[0]) + int(numbers[1])
            elif '-' in captcha_question:
                captcha_answer = int(numbers[0]) - int(numbers[1])
            elif '*' in captcha_question or 'x' in captcha_question.lower():
                captcha_answer = int(numbers[0]) * int(numbers[1])
            print(f"✅ Captcha obtained: {captcha_question} = {captcha_answer}")

            # Step 2: Login as admin to get token
            print("\n" + "=" * 60)
            print("STEP 2: Login as admin")
            print("=" * 60)

            login_data = {
                "username": "admin",
                "password": "admin123",
                "captcha_id": captcha_id,
                "captcha_answer": str(captcha_answer)
            }

            login_response = await client.post(
                f"{base_url}/auth/login",
                json=login_data,
                timeout=10.0
            )

            if login_response.status_code != 200:
                print(f"❌ Login failed: {login_response.status_code}")
                print(f"Response: {login_response.text}")
                return

            login_result = login_response.json()
            token = login_result.get('access_token')
            print(f"✅ Login successful")
            print(f"Token: {token[:50] if token else 'No token'}...")

            # Step 3: Create new RKAM budget item
            print("\n" + "=" * 60)
            print("STEP 3: Create new RKAM budget item")
            print("=" * 60)

            new_item = {
                "code": "TEST-001",
                "name": "Test Budget Item - Manual Entry",
                "category": "Operasional",
                "bidang": "tata_usaha",
                "sumber_dana": "BOS",
                "description": "Test item created via API to debug save issue",
                "allocated_amount": 5000000,
                "realized_amount": 0,
                "fiscal_year": "2025/2026",
                "quarter": "Q1",
                "month": None
            }

            print(f"Payload: {json.dumps(new_item, indent=2)}")

            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }

            create_response = await client.post(
                f"{base_url}/rkam/budget-items",
                json=new_item,
                headers=headers,
                timeout=10.0
            )

            print(f"\nResponse Status: {create_response.status_code}")
            print(f"Response Body: {create_response.text}")

            if create_response.status_code == 200:
                result = create_response.json()
                item_id = result.get('id')
                print(f"\n✅ Item created successfully!")
                print(f"ID: {item_id}")

                # Step 4: Verify item exists in database
                print("\n" + "=" * 60)
                print("STEP 4: Verify item in database")
                print("=" * 60)

                list_response = await client.get(
                    f"{base_url}/rkam/budget-items",
                    headers=headers,
                    params={"fiscal_year": "2025/2026"},
                    timeout=10.0
                )

                if list_response.status_code == 200:
                    items = list_response.json()
                    found = False
                    for item in items:
                        if item.get('id') == item_id:
                            found = True
                            print(f"✅ Item found in database!")
                            print(f"Data: {json.dumps(item, indent=2, default=str)}")
                            break

                    if not found:
                        print(f"❌ Item NOT found in list!")
                        print(f"Total items in list: {len(items)}")
                else:
                    print(f"❌ Failed to list items: {list_response.status_code}")
            else:
                print(f"\n❌ Failed to create item")
                print(f"Error: {create_response.text}")

        except Exception as e:
            print(f"❌ Exception occurred: {str(e)}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_rkam_post())
