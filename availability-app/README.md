# Engineer Availability App

A visual availability management system for your engineering team. Engineers can set their availability using a drag-to-paint calendar interface, and your n8n chatbot can query who's available at any given time.

## Features

- 🎨 **Visual drag-to-paint calendar** - Click and drag to set availability
- 🔄 **Recurring rules** - Set weekly patterns like "Available Mon-Fri 9am-5pm"
- 📱 **Mobile-friendly** - Works on phones for on-the-go updates
- 🤖 **n8n Integration** - API endpoints for your chatbot to query availability
- 📅 **Session sync** - Automatically marks booked sessions as unavailable
- ⏱️ **"Latest wins" logic** - Overlapping rules automatically resolve by timestamp

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local` and fill in your Airtable credentials:

```bash
cp .env.example .env.local
```

Your `.env.local` should contain:
```
AIRTABLE_API_KEY=your_airtable_api_key
AIRTABLE_BASE_ID=appImc0fqEWTHi5Aq
ENGINEERS_TABLE_ID=tblP6ActIEN2tgOsY
AVAILABILITY_TABLE_ID=tblJNDfA8kiEDTDlT
SESSIONS_TABLE_ID=tbltH86ymLUNGOdsn
SESSIONS_VIEW_ID=viweGNUyppz2Sfhii
TIMEZONE=America/New_York
```

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

---

## Deploying to Vercel (Free)

### Step 1: Push to GitHub

1. Create a new repository on GitHub
2. Push this code to the repository:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Step 2: Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "New Project"
3. Import your repository
4. **Important:** Add your environment variables in the Vercel dashboard:
   - `AIRTABLE_API_KEY`
   - `AIRTABLE_BASE_ID`
   - `ENGINEERS_TABLE_ID`
   - `AVAILABILITY_TABLE_ID`
   - `SESSIONS_TABLE_ID`
   - `SESSIONS_VIEW_ID`
   - `TIMEZONE`
5. Click "Deploy"

Your app will be live at `https://your-project.vercel.app`

---

## API Endpoints (for n8n)

### Query availability for a specific time slot

```
GET /api/availability?date=2025-01-03&start=18:00&end=20:00
```

Returns:
```json
{
  "date": "2025-01-03",
  "start_time": "18:00",
  "end_time": "20:00",
  "summary": {
    "available": ["Marcus", "Tina"],
    "maybe": ["DeShawn"],
    "unavailable": ["Jordan"],
    "booked": ["Alex"],
    "not_set": ["Chris"]
  }
}
```

### Query a specific engineer's full day

```
GET /api/availability?date=2025-01-03&engineer=Marcus&detailed=true
```

### Set availability via chatbot

```
POST /api/chatbot
Content-Type: application/json

{
  "engineer": "Marcus",
  "status": "Unavailable",
  "date": "2025-01-03",
  "start_time": "09:00",
  "end_time": "17:00"
}
```

### Set recurring availability via chatbot

```
POST /api/chatbot
Content-Type: application/json

{
  "engineer": "Marcus",
  "status": "Available",
  "days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
  "start_time": "18:00",
  "end_time": "02:00",
  "effective_from": "2025-01-01"
}
```

---

## n8n Integration Example

### Querying availability in n8n

1. Add an **HTTP Request** node
2. Set method to `GET`
3. URL: `https://your-app.vercel.app/api/availability`
4. Add query parameters:
   - `date`: `{{ $json.date }}` (or a specific date)
   - `start`: `{{ $json.start_time }}`
   - `end`: `{{ $json.end_time }}`

### Updating availability via chatbot

1. Add an **HTTP Request** node
2. Set method to `POST`
3. URL: `https://your-app.vercel.app/api/chatbot`
4. Body (JSON):
```json
{
  "engineer": "{{ $json.engineer_name }}",
  "status": "{{ $json.status }}",
  "date": "{{ $json.date }}",
  "start_time": "{{ $json.start_time }}",
  "end_time": "{{ $json.end_time }}"
}
```

---

## Airtable Schema

### Engineers Table
| Field | Type |
|-------|------|
| Name | Text |
| Email | Email |
| Phone# (E.164) | Phone |
| Active | Checkbox |

### Availability_Rules Table
| Field | Type |
|-------|------|
| Engineer | Link to Engineers |
| Status | Single Select (Available, Maybe, Unavailable) |
| Rule_Type | Single Select (one-time, recurring) |
| Start_DateTime | Date with time |
| End_DateTime | Date with time |
| Start_Time | Text |
| End_Time | Text |
| Recurrence_Days | Multiple Select (Mon, Tue, Wed, Thu, Fri, Sat, Sun) |
| Effective_From | Date |
| Effective_Until | Date |
| Source | Single Select (web_app, chatbot, booking) |
| Created_Time | Created time |
| Updated_Time | Last modified time |

---

## How "Latest Wins" Works

When multiple rules overlap for the same time slot, the rule with the most recent `Updated_Time` wins. This means:

1. Engineer sets "Available" for Friday 1pm-10pm
2. Later, engineer sets "Unavailable" for Friday 6pm-8pm
3. Result: Available 1pm-6pm, Unavailable 6pm-8pm, Available 8pm-10pm

When a session is booked, it creates an implicit "Unavailable" override for that time slot.
