# WMS + HIK RCS 4.3 Backend

FastAPI backend อ้างอิง `WASNA4.3/server.js` และคง API ที่ Robot Task Dispatcher เดิมใช้ไว้
แก้เฉพาะ Backend ส่วน Warehouse Monitor / Inventory / Storage Locations ไม่เกี่ยวกับ patch นี้

## ติดตั้ง (Windows PowerShell)

นำโฟลเดอร์ `backend` ใน ZIP ไปวางทับ `IWOE_RCS/backend` โดยเก็บไฟล์ `rcs_bridge.db` เดิมไว้
ZIP นี้ไม่มีฐานข้อมูลหรือ `.env` ของคุณ จึงไม่แทนข้อมูลเดิม

เปิด Terminal ใน `IWOE_RCS/backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

ถ้ายังไม่มี `.env` ให้คัดลอก `.env.example` เป็น `.env` แล้วแก้:

```dotenv
RCS_MODE=HIK
HIK_RCS_BASE_URL=http://192.168.100.101/rcs/rtas/api/robot/controller
HIK_RCS_API_VERSION=v1.0
HIK_RCS_TIMEOUT_SECONDS=30
HIK_TASK_TYPE=
```

โปรแกรมอ่าน `.env` จากโฟลเดอร์ backend อัตโนมัติ หากเคยตั้ง `$env:RCS_MODE` ใน Terminal ค่านั้นมีลำดับเหนือ `.env`
URL อ้างอิงจากรุ่นพี่ ต้องเป็นเครื่อง RCS ที่เข้าถึงได้จากเครื่องรัน FastAPI ไม่ใช่ URL หน้าเว็บ portal
หากระบุเพียง `http://192.168.100.101` โปรแกรมจะเติม `/rcs/rtas/api/robot/controller` ให้

`HIK_TASK_TYPE` ใช้แปลง `TRANSPORT` จาก WMS เดิมเป็น task template จริง ตัวอย่างรุ่นพี่:

| ประเภท | taskType |
|---|---|
| CTU | CTUW |
| LMR | F05 |
| FMR | F115 |
| QF | F116 |

เลือกตาม template ที่มีจริงใน RCS; ตัวอย่างนี้ไม่ได้ยืนยันว่าทุก installation มีรหัสเดียวกัน
เช่น หากใช้งาน LMR workflow ของรุ่นพี่ ให้ตั้ง `HIK_TASK_TYPE=F05`
การปล่อยว่างจะยัง query หุ่นยนต์ได้ แต่การส่งงาน `TRANSPORT` จะคืน 422 แทนการเดา task template

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

เปิด `http://127.0.0.1:8000/docs` เพื่อเรียก API
Frontend เดิมใช้ backend พอร์ต 8000; Vite ใช้ localhost หรือ 127.0.0.1 พอร์ต 5173 ตาม CORS เดิม

## เริ่มตรวจการเชื่อมต่อด้วยการอ่านข้อมูลหุ่นยนต์

เรียก `POST /api/rcs/connection/check` ใน Swagger ด้วย Robot Code จริง:

```json
{"singleRobotCode": "ROBOT_CODE_FROM_RCS"}
```

Backend จะเรียก `POST {controller}/robot/query` เมื่อ RCS คืน `code: SUCCESS` จึงตอบ `connected: true`
ไม่มีการส่งงานเคลื่อนที่ในการตรวจนี้

`GET /api/rcs/status` แสดง readiness ของ backend และฐานข้อมูลเท่านั้น
`connectionStatus: NOT_CHECKED` ไม่ได้แปลว่าเชื่อม RCS สำเร็จ
โหมด MOCK แสดง SIMULATION; API direct ทั้งหมดคืน 409 และไม่ยิง HTTP ออกไป

## API สำหรับ WMS เดิม (บันทึก SQLite)

- `POST /api/rcs/tasks` รับ `robotTaskCode` ของ WMS, `taskType`, `source`, `destination`, `initPriority`
- `GET /api/rcs/tasks/{bridgeTaskId}` อ่านงานและ query RCS
- `GET /api/rcs/tasks` อ่านรายการงานและ query สถานะ

```json
{
  "robotTaskCode": "WMS-TEST-001",
  "taskType": "F05",
  "initPriority": 60,
  "source": {"type": "SITE", "code": "SOURCE_CODE_FROM_RCS"},
  "destination": {"type": "SITE", "code": "DESTINATION_CODE_FROM_RCS"}
}
```

Backend แปลงเป็น `targetRoute` ที่มี `seq: 0, 1` ตามรุ่นพี่
ไม่เติม `autoStart` เอง; หากต้องการสามารถระบุ `autoStart: 0` หรือ `1` ใน source/destination
รองรับ optional `robotType`, `robotCode`, `groupCode`, `deadlineTime`, `interrupt`, `extra`
`mapCode` เป็น metadata ของ WMS และไม่ส่งเป็น field เพิ่มใน targetRoute
`scheduledSendAt` เดิมเป็น metadata; Backend นี้ไม่ได้ทำ background scheduling และ POST จะส่งทันที

`robotTaskCode` ของ WMS เป็นคนละค่ากับ ID ที่ RCS สร้าง
ค่าที่ RCS คืน `data.robotTaskCode` เก็บเป็น `rcsTaskChainCode` และใช้ค่านี้ในการ query/cancel RCS

## API แบบรุ่นพี่ (direct proxy)

| Local API | Upstream suffix |
|---|---|
| POST /api/robot/query หรือ /api/rcs/robot/query หรือ /api/ctu/robot/query | /robot/query |
| POST /api/{family}/task/submit | /task/submit |
| POST /api/{family}/task/query หรือ /api/rcs/task/query | /task/query |
| POST /api/{family}/task/cancel หรือ /api/rcs/task/cancel | /task/cancel |
| POST /api/ctu/carrier/bind | /carrier/bind |
| POST /api/ctu/carrier/unbind | /carrier/unbind |
| POST /api/ctu/site/bind, /api/lmr/site/bind, /api/qf/site/bind | /site/bind |
| POST /api/fmr/bin/bind หรือ /api/ctu/bin/link | /site/bind |

`family` สำหรับ task คือ ctu / lmr / fmr / qf
หาก direct submit ไม่ระบุ taskType จะใช้รหัสตัวอย่างของ family ตามตาราง
ระบุ taskType เองเพื่อใช้ template อื่นได้
ตัวเลือกและชนิดข้อมูลทั้งหมดแสดงใน Swagger

ตัวอย่าง direct submit LMR (คำสั่งนี้สร้างงานจริงเมื่อ RCS_MODE=HIK):

```json
{
  "taskType": "F05",
  "targetRoute": [
    {"seq": 0, "type": "SITE", "code": "SOURCE_CODE_FROM_RCS"},
    {"seq": 1, "type": "SITE", "code": "DESTINATION_CODE_FROM_RCS"}
  ],
  "initPriority": 99
}
```

Query ใช้ `{"robotTaskCode":"ACTUAL_RCS_TASK_CODE"}`
Cancel ใช้ `{"robotTaskCode":"ACTUAL_RCS_TASK_CODE","cancelType":"CANCEL"}`
การตอบรับ cancel ไม่เท่ากับงานยกเลิกเสร็จแล้ว ต้อง query ต่อ

Direct proxy ไม่สร้างรายการใน SQLite ของ WMS และไม่ทำ stock operation
หากต้องการให้งานปรากฏใน Robot Task Dispatcher เดิม ให้ส่งผ่าน `/api/rcs/tasks`
อย่าส่งงานเดียวกันซ้ำผ่านทั้งสองช่องทาง

## Error / protocol

Headers ตาม WASNA4.3: Content-Type application/json;charset=UTF-8, Accept application/json,
X-lr-request-id 16 ตัวอักษร, X-lr-trace-id 32 ตัวอักษร, X-lr-version v1.0

- 422: request ไม่ถูกต้อง หรือ TRANSPORT ยังไม่มี HIK_TASK_TYPE
- 409: เรียก direct API ขณะอยู่ MOCK หรือ WMS มีงาน active ซ้ำ
- 502: RCS ตอบ HTTP/business error, JSON ผิดรูปแบบ หรือ submit ไม่คืน task ID
- 503: network error / timeout / ไม่กำหนด URL

ไม่ retry submit/cancel/bind อัตโนมัติ หาก timeout งานอาจถูกสร้างแล้ว ให้ตรวจ RCS ก่อนส่งใหม่
Direct response เก็บคำตอบ RCS เต็มใน `data`; business rejection อยู่ใน `detail.rcsResponse`
WMS polling รองรับสถานะข้อความ CREATED/RUNNING/COMPLETED/CANCELLED/FAILED และคำเทียบในโค้ด
ยังไม่เดาความหมายสถานะตัวเลข/รหัสเฉพาะ ต้องเทียบกับ response จริงก่อนเพิ่ม mapping
ยังไม่มีการผูก carrier อัตโนมัติก่อนส่งงาน ต้องเรียก bind ตาม workflow จริงของแต่ละหุ่นยนต์

## การตรวจสอบ

ทดสอบ 10 กรณีด้วย HTTP transport จำลองและฐานข้อมูลชั่วคราว: family payload, query/check,
cancel/bind, validation, MOCK isolation, error propagation, headers/URL, task mapping และ SQLite lifecycle
ไม่ได้ติดต่อ HIK ที่บริษัทหรือทดสอบการเคลื่อนที่จริง

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-test.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```
