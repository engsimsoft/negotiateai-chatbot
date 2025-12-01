import google.generativeai as genai
import os

# --- Конфигурация ---
# Важно: Убедитесь, что ваш API-ключ установлен как переменная окружения GOOGLE_GENERATIVE_AI_API_KEY
# genai.configure(api_key="ВАШ_КЛЮЧ_ЗДЕСЬ") # или раскомментируйте и вставьте ключ сюда
# ---

try:
    if not os.getenv('GOOGLE_GENERATIVE_AI_API_KEY'):
        raise ValueError("Ошибка: Переменная окружения GOOGLE_GENERATIVE_AI_API_KEY не найдена. Установите ее или впишите ключ в скрипт.")

    print("✅ Ключ API найден. Получение списка моделей...")

    models = [m.name for m in genai.list_models()]

    if not models:
        print("❌ Модели не найдены. Проверьте ваш API-ключ и права доступа.")
    else:
        print("\n--- 🎯 ДОСТУПНЫЕ МОДЕЛИ ---")
        for model_name in sorted(models):
            print(f"- {model_name}")
        print("--------------------------\n")
        print("💡 Скопируйте точное название (например, 'models/gemini-1.5-pro-latest') и используйте его в коде.")

except Exception as e:
    print(f"❌ Произошла ошибка: {e}")

