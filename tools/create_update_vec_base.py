from openai import OpenAI
import os
from dotenv import load_dotenv

# load_dotenv(dotenv_path=".env", override=False)
# OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
# if not OPENAI_API_KEY:
#     raise RuntimeError("OPENAI_API_KEY is not set")

# client = OpenAI(api_key=OPENAI_API_KEY)

# # 读取指定文件夹下的所有 .md 文件
# folder = "/root/temp_files/icy/textbook"
# md_files = [
#     open(os.path.join(folder, f), "rb")
#     for f in os.listdir(folder)
#     if f.endswith(".md")
# ]

# # 1. 创建一个新的 Vector Store
# vector_store = client.vector_stores.create(name="my_textbook_store_test")

# # 2. 上传 textbook.md 文件到这个 Vector Store
# file_batch = client.vector_stores.files.upload_and_poll(
#     vector_store_id=vector_store.id,
#     files=md_files,   # 本地路径
# )

# print("Vector Store ID:", vector_store.id)
# print("Uploaded files:", file_batch)






load_dotenv(dotenv_path=".env", override=False)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not set")

client = OpenAI(api_key=OPENAI_API_KEY)

# 1) 创建（或直接跳过，用你已有的 vs_id）
vs = client.vector_stores.create(name="icy_textbook_store")
vs_id = vs.id
print("Vector Store ID:", vs_id)

# 2) 收集并打开 .md 文件（建议控制数量，避免一次打开太多文件）
folder ="/root/temp_files/icy/textbook"
paths = [os.path.join(folder, f) for f in os.listdir(folder) if f.endswith(".md")]
if not paths:
    raise RuntimeError("目录下没有找到 .md 文件")

# 3) 批量上传并等待索引完成（files 需要 file-like 对象）
file_objs = [open(p, "rb") for p in paths]
try:
    batch = client.vector_stores.file_batches.upload_and_poll(
        vector_store_id=vs_id,
        files=file_objs,   # ← 注意是文件对象列表
    )
    print("Batch status:", batch.status)
    print("Counts:", batch.file_counts)
finally:
    # 关闭句柄
    for f in file_objs:
        try: f.close()
        except: pass