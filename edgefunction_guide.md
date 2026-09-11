# 스케줄 푸시 — 클릭 단위 가이드

앱(`App.tsx`, `src/`)은 열지 않는다.  
이미 작성된 코드는 `supabase/functions/send-scheduled-push/` 이다.  
당신이 할 일은 **웹 콘솔에서 키를 넣고, 터미널에서 배포하고, cron을 거는 것**이다.

전체 순서:

1. 파이어베이스에서 서비스 계정 JSON 받기  
2. 슈퍼베이스 시크릿 3개 넣기  
3. 터미널에서 함수 배포  
4. curl로 한 번 눌러 보기  
5. 외부 cron 연결  
6. 아이폰 앱에서 알림 시간 맞추고 수신 확인  

---

## 0. 시작 전에 열려 있는 것

- 컴퓨터 브라우저
- 프로젝트 폴더: `/Users/doyeob/Doyeob/study/cursor/yWheather`
- 아이폰에 깔린 yWeather 앱 (6번에서 사용)
- `.env` 파일 (기상청 키 복사할 때 사용)

코드 수정은 하지 않는다.

---

## 1. 파이어베이스 — 서비스 계정 JSON 받기

FCM을 **서버에서** 보내려면 이 JSON이 필요하다. 앱의 `GoogleService-Info.plist`와는 다른 파일이다.

### 1-1. 콘솔 들어가기

1. 브라우저에서 연다: https://console.firebase.google.com/
2. Google 계정으로 로그인
3. 프로젝트 목록에서 **이 앱이 쓰는 프로젝트**를 클릭한다  
   (잘 모르겠으면 `GoogleService-Info.plist` 안의 `PROJECT_ID` 와 이름이 같은 프로젝트)

### 1-2. 서비스 계정 키 만들기

1. 왼쪽 위 톱니바퀴(프로젝트 설정)를 클릭한다  
   톱니바퀴가 안 보이면 왼쪽 메뉴 맨 위 기어 → **프로젝트 설정**
2. 위쪽 탭에서 **서비스 계정** 을 클릭한다  
   (일반 / Cloud Messaging / 서비스 계정 중 맨 오른쪽 근처)
3. 페이지 아래쪽 **Admin SDK 구성** 영역에서  
   **새 비공개 키 생성** 버튼을 클릭한다
4. 확인 창이 뜨면 **키 생성** 을 클릭한다
5. JSON 파일이 다운로드된다  
   이름 예: `yweather-xxxxx-firebase-adminsdk-xxxxx.json`

### 1-3. 파일 보관

- 이 파일을 메모장/VSCode로 연다
- `{` 로 시작해서 `}` 로 끝나는 **전체**를 나중에 복사한다
- git에 올리지 않는다. 바탕화면이나 다운로드 폴더에만 둔다

끝났으면 JSON 안에 `"project_id"`, `"client_email"`, `"private_key"` 가 보이면 성공이다.

---

## 2. 슈퍼베이스 — 비밀값(Secrets) 3개 넣기

함수가 실행될 때 읽을 비밀번호 3개다.  
넣는 곳: **슈퍼베이스 웹 대시보드** (아래 2-A) 또는 터미널 (2-B). **둘 중 하나만** 하면 된다. 웹이 더 쉽다.

### 2-A. 웹에서 넣기 (추천)

1. 브라우저에서 연다: https://supabase.com/dashboard
2. 로그인 후 프로젝트 **fenuxlgeyfshztwzdxrb** 를 클릭한다  
   직접 주소: https://supabase.com/dashboard/project/fenuxlgeyfshztwzdxrb
3. 왼쪽 메뉴 맨 아래쪽 **Project Settings** (톱니바퀴) 클릭
4. 왼쪽 설정 메뉴에서 **Edge Functions** 클릭  
   (Edge Functions가 안 보이면 **Configuration** 아래를 찾는다)
5. **Secrets** / **Manage secrets** 영역으로 간다
6. **Add new secret** (또는 이름 + 값 입력란)으로 아래를 **하나씩** 추가한다

**시크릿 1**

- Name: `CRON_SECRET`
- Value: 아무 긴 비밀번호. 예: `yweather-cron-2026-secret`  
  (특수문자 포함해도 됨. 공백은 넣지 말 것)
  cron 으로 설정
- 이 값을 메모장에 따로 적어 둔다. 4번 curl, 5번 cron에서 그대로 쓴다

**시크릿 2**

- Name: `FIREBASE_SERVICE_ACCOUNT_JSON`
- Value: 1번에서 받은 JSON **파일 내용 전체**를 붙여넣기  
  첫 글자가 `{` 이고 마지막이 `}` 이어야 한다  
  한 줄이든 여러 줄이든 상관없다

**시크릿 3**

- Name: `KMA_SERVICE_KEY`
- Value: 프로젝트 `.env` 파일을 연다  
  `EXPO_PUBLIC_KMA_SERVICE_KEY=` **오른쪽 값만** 복사해서 붙인다  
  `%2B` 같은 글자가 있으면 그대로 둔다. 다시 인코딩하지 않는다

7. 각각 Save / Add 한다
8. 목록에 세 이름이 보이면 끝이다. 값은 다시 안 보여도 정상이다

### 2-B. 터미널에서 넣기 (웹 대신일 때만)

Cursor / 터미널을 연다. **Metro가 돌아가는 창이 아닌 새 창**을 쓰는 것이 편하다.

```bash
cd /Users/doyeob/Doyeob/study/cursor/yWheather
npx supabase login
```

브라우저가 열리면 Allow / 로그인한다.

```bash
npx supabase link --project-ref fenuxlgeyfshztwzdxrb
```

데이터베이스 비밀번호를 물으면 슈퍼베이스 대시보드  
**Project Settings → Database → Database password** 의 비밀번호를 넣는다.  
(모르면 웹 방식 2-A를 쓴다.)

```bash
npx supabase secrets set CRON_SECRET=yweather-cron-2026-secret
```

JSON은 따옴표 안에 한 덩어리로:

```bash
npx supabase secrets set FIREBASE_SERVICE_ACCOUNT_JSON="$(cat ~/Downloads/다운받은파일.json)"
```

`~/Downloads/다운받은파일.json` 을 실제 파일 경로로 바꾼다.

```bash
npx supabase secrets set KMA_SERVICE_KEY='.env에있던키그대로'
```

확인:

```bash
npx supabase secrets list
```

세 이름이 보이면 성공이다. 값은 목록에 안 나온다.

---

## 3. 함수 배포 (터미널)

코드는 이미 있다. 슈퍼베이스 서버에 **올리는** 단계다.

1. 터미널에서 프로젝트 폴더인지 확인한다

```bash
cd /Users/doyeob/Doyeob/study/cursor/yWheather
ls supabase/functions/send-scheduled-push
```

`index.ts` 와 `kmaWeather.ts` 가 보여야 한다.

2. (2-B를 안 했다면) 한 번 연결

```bash
npx supabase login
npx supabase link --project-ref fenuxlgeyfshztwzdxrb
```

3. 배포

```bash
npx supabase functions deploy send-scheduled-push --no-verify-jwt
```

`--no-verify-jwt` 는 빼면 안 된다. 외부 cron은 로그인 JWT가 없다.

4. 성공 로그에 비슷한 문구가 나온다

```
Deployed Functions on project fenuxlgeyfshztwzdxrb: send-scheduled-push
```

5. 대시보드에서도 확인한다  
   https://supabase.com/dashboard/project/fenuxlgeyfshztwzdxrb/functions  
   왼쪽 **Edge Functions** 메뉴  
   목록에 `send-scheduled-push` 가 있으면 성공이다

함수 주소 (이후 항상 이것만 쓴다):

```
https://fenuxlgeyfshztwzdxrb.supabase.co/functions/v1/send-scheduled-push
```

---

## 4. 손으로 한 번 호출해서 확인

cron 걸기 전에, 지금 이 주소가 살아 있는지 본다.

### 4-1. 앱에서 스케줄을 “지금”에 맞추기

`matched: 0` 이 나오지 않게 하려면, 호출하는 **그 분**에 켜 둔 알림이 있어야 한다.

1. 아이폰에서 yWeather 앱을 연다
2. 로그인한다
3. 왼쪽 메뉴(햄버거) → **날씨 알림**
4. 알림이 없으면 + 로 하나 만든다 (지역, 요일에 오늘 포함, 사용중 ON)
5. 시간을 **지금에서 가장 가까운 10분 단위**로 맞춘다  
   예: 지금 23:52 이면 **23:50** 또는 **00:00**  
   23:50으로 두면, 23:50분에 4-2를 실행해야 한다  
   테스트가 급하면 시간을 바로 다가올 10분으로 맞추고 그때 curl 한다

### 4-2. 맥 터미널에서 curl

`여기CRON시크릿` 을 2번에 넣은 `CRON_SECRET` 값으로 바꾼다.

```bash
curl -X POST "https://fenuxlgeyfshztwzdxrb.supabase.co/functions/v1/send-scheduled-push" \
  -H "x-cron-secret: 여기CRON시크릿" \
  -H "Content-Type: application/json"
```
```
curl -X POST "https://fenuxlgeyfshztwzdxrb.supabase.co/functions/v1/send-scheduled-push" \
  -H "x-cron-secret: cron" \
  -H "Content-Type: application/json"
```

### 4-3. 결과 보는 법

**권한이 없습니다 / 401**  
→ 헤더 `x-cron-secret` 과 슈퍼베이스 `CRON_SECRET` 이 다르다. 공백, 따옴표를 확인한다.

**`"matched": 0`**  
→ 지금 한국시간 시:분, 요일에 맞는 `use_yn = Y` 알림이 없다. 4-1로 돌아가 시간을 맞춘다.

**`"sent": 1` 이상**  
→ 아이폰 알림을 본다. 잠금화면 예:

```
다율동 23° 맑음
최고/최저 28°/18°
어제보다 2° 낮아요
강수확률 20%
```

**`"errors"` 에 FIREBASE / 토큰**  
→ 2번 `FIREBASE_SERVICE_ACCOUNT_JSON` 이 잘못됐거나, 기기에 FCM 토큰이 없다.  
  앱을 한 번 켜서 로그인했는지, 알림 권한을 허용했는지 본다.

**날씨 정보를 가져오지 못했습니다**  
→ `KMA_SERVICE_KEY` 가 없거나 잘못됐다. 2번 시크릿 3을 다시 넣는다.

로그는 대시보드 **Edge Functions → send-scheduled-push → Logs** 에서도 볼 수 있다.

---

## 5. 외부에서 1분마다 자동 호출 (cron)

4번이 성공한 뒤에 한다.  
아래 **5-A 또는 5-B 중 하나**면 된다.

### 5-A. cron-job.org (웹, 쉬움)

1. https://cron-job.org/ 접속 후 회원가입 / 로그인
2. **CREATE CRONJOB** (또는 Create cronjob) 클릭
3. 입력:

| 항목 | 넣을 값 |
|---|---|
| Title | `yweather-push` |
| Address (URL) | `https://fenuxlgeyfshztwzdxrb.supabase.co/functions/v1/send-scheduled-push` |
| Request method | **POST** (기본 GET이면 반드시 POST로 변경) |
| Schedule | Every minute / 매 1분 / `* * * * *` |

4. **Request headers** (헤더 추가) 를 연다  
   - Header name: `x-cron-secret`  
   - Header value: 2번의 `CRON_SECRET` 값 그대로  
5. **CREATE** / 저장
6. 1~2분 기다린 뒤 아이폰, 또는 슈퍼베이스 Functions Logs 에 호출이 찍히는지 본다

cron-job.org 무료는 1분 간격이 가능할 때가 많다. 안 되면 5분으로라도 먼저 확인하고, 앱 알림 시각과 겹치는 분에만 발송된다.

### 5-B. 슈퍼베이스 안에서 cron (pg_cron)

외부 사이트를 쓰기 싫을 때.

1. https://supabase.com/dashboard/project/fenuxlgeyfshztwzdxrb  
2. 왼쪽 **Database** → **Extensions**
3. 검색창에 `pg_cron` → **Enable**  
4. 검색창에 `pg_net` → **Enable**  
   (`http` 라는 이름이면 그것도 켠다. 프로젝트마다 이름이 `pg_net` 이다)
5. 왼쪽 **SQL Editor** 클릭
6. **New query**
7. 아래를 붙여넣는다. `'여기CRON시크릿'` 만 2번 값으로 바꾼다

```sql
select cron.schedule(
  'send-scheduled-push-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://fenuxlgeyfshztwzdxrb.supabase.co/functions/v1/send-scheduled-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '여기CRON시크릿'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

8. 오른쪽 아래 **Run** (또는 Ctrl/Cmd + Enter)
9. 에러 없이 한 줄 결과가 나오면 성공  
   `cron` / `net` 을 모른다는 에러면 3~4번 Extension이 안 켜진 것이다

등록된 cron 확인:

```sql
select * from cron.job;
```

지우기:

```sql
select cron.unschedule('send-scheduled-push-every-minute');
```

---

## 6. 아이폰에서 최종 확인

1. 앱 로그인
2. 날씨 알림이 **사용중**
3. 요일에 **오늘**이 들어가 있음
4. 시각이 10분 단위 (07:00, 07:10, …)
5. 그 시각 + 1분 안에 알림이 오는지 본다  
   (cron이 그 분에 한 번 호출해야 함)
6. 오지 않으면:
   - 슈퍼베이스 Edge Functions → Logs
   - 4번 curl을 그 분에 다시 실행해서 앱 문제인지 cron 문제인지 가른다

---

## 막혔을 때 어디를 보나

| 증상 | 어디 |
|---|---|
| 배포 실패 | 터미널 에러. `supabase login` / `link` 다시 |
| 401 권한 | Secrets의 `CRON_SECRET` vs curl/cron 헤더 |
| matched 0 | 앱 알림 시간·요일·사용중 |
| 날씨 문구 실패 | Secret `KMA_SERVICE_KEY` |
| 푸시 자체 실패 | Secret `FIREBASE_SERVICE_ACCOUNT_JSON`, 폰 알림 권한, FCM 토큰 |
| cron은 도는데 푸시 없음 | Logs의 `sent`, `errors` |

로그 위치:  
https://supabase.com/dashboard/project/fenuxlgeyfshztwzdxrb/functions  
→ `send-scheduled-push` 클릭 → **Logs**

---

## 다시 손대는 경우만

문구/로직을 바꿀 때:

1. `supabase/functions/send-scheduled-push/kmaWeather.ts` 또는 `index.ts` 수정
2. **3번 배포를 다시** 한다 (`npx supabase functions deploy send-scheduled-push --no-verify-jwt`)
3. 시크릿은 다시 넣을 필요 없다

