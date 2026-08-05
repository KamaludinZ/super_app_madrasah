"""Test GET endpoint untuk RKAM budget items"""
import asyncio
import httpx
import sys
import re

# Fix Windows encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

async def test_get_endpoint():
    base_url = "http://127.0.0.1:8000/api"

    async with httpx.AsyncClient() as client:
        try:
            # Get captcha
            captcha_response = await client.get(f"{base_url}/auth/captcha", timeout=10.0)
            captcha_data = captcha_response.json()
            captcha_id = captcha_data['challenge_id']
            captcha_question = captcha_data['question']

            numbers = re.findall(r'\d+', captcha_question)
            if '+' in captcha_question:
                captcha_answer = int(numbers[0]) + int(numbers[1])
            elif '-' in captcha_question:
                captcha_answer = int(numbers[0]) - int(numbers[1])
            elif '*' in captcha_question or 'x' in captcha_question.lower():
                captcha_answer = int(numbers[0]) * int(numbers[1])

            # Login
            login_data = {
                "username": "admin",
                "password": "admin123",
                "captcha_id": captcha_id,
                "captcha_answer": str(captcha_answer)
            }

            login_response = await client.post(f"{base_url}/auth/login", json=login_data, timeout=10.0)

            if login_response.status_code != 200:
                print(f"❌ Login failed: {login_response.status_code}")
                print(f"Response: {login_response.text}")
                return

            login_result = login_response.json()
            token = login_result.get('access_token')
            print(f"✅ Login successful")

            # Test GET endpoint
            print("\n" + "=" * 60)
            print("Testing GET /rkam/budget-items")
            print("=" * 60)

            headers = {
                "Authorization": f"Bearer {token}"
            }

            get_response = await client.get(
                f"{base_url}/rkam/budget-items",
                headers=headers,
                params={"fiscal_year": "2025/2026"},
                timeout=15.0
            )

            print(f"Response Status: {get_response.status_code}")

            if get_response.status_code == 200:
                items = get_response.json()
                print(f"✅ GET endpoint working!")
                print(f"Total items returned: {len(items)}")

                for idx, item in enumerate(items[:5], 1):
                    print(f"\n{idx}. {item.get('code', 'NO-CODE')} - {item.get('name')}")
                    print(f"   Allocated: Rp {item.get('allocated_amount'):,.0f}")
                    print(f"   Realized: Rp {item.get('realized_amount'):,.0f}")
                    print(f"   Sumber Dana: {item.get('sumber_dana')}")

                if len(items) > 5:
                    print(f"\n... and {len(items) - 5} more items")
            else:
                print(f"❌ GET failed")
                print(f"Response: {get_response.text}")

        except Exception as e:
            print(f"❌ Exception: {str(e)}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_get_endpoint())
