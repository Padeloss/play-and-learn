import os
import json

def convert_py_to_json(lessons_folder):
    """Μετατρέπει τα .py αρχεία με ερωτήσεις σε .json format μέσα στον φάκελο lessons."""
    for subject_folder in os.listdir(lessons_folder):
        subject_path = os.path.join(lessons_folder, subject_folder)
        if os.path.isdir(subject_path):
            for difficulty_file in os.listdir(subject_path):
                if difficulty_file.endswith(".py"):
                    py_file_path = os.path.join(subject_path, difficulty_file)
                    json_file_path = os.path.join(subject_path, difficulty_file.replace('.py', '.json'))
                    with open(py_file_path, 'r', encoding='utf-8') as py_file:
                        # Εκτελούμε το αρχείο Python και διαβάζουμε τις ερωτήσεις του
                        namespace = {}
                        exec(py_file.read(), namespace)
                        questions = namespace.get("questions", [])

                    # Αποθηκεύουμε τις ερωτήσεις σε JSON format
                    with open(json_file_path, 'w', encoding='utf-8') as json_file:
                        json.dump(questions, json_file, ensure_ascii=False, indent=4)
                    
                    # Αφαιρούμε το αρχικό αρχείο Python
                    os.remove(py_file_path)
                    print(f"Μετατράπηκε το {py_file_path} σε {json_file_path}.")

if __name__ == "__main__":
    lessons_folder = "lessons"
    convert_py_to_json(lessons_folder)
