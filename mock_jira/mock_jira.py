from fastapi import FastAPI, Header, HTTPException, Request
import logging

app = FastAPI()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mock-jira")

issues_count = 0

@app.post("/rest/api/2/issue")
async def create_issue(request: Request, authorization: str = Header(None)):
    global issues_count
    if not authorization:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    payload = await request.json()
    logger.info(f"Received authorization: {authorization}")
    logger.info(f"Received issue creation request: {payload}")
    
    fields = payload.get("fields", {})
    project_key = fields.get("project", {}).get("key", "COMP")
    issue_type = fields.get("issuetype", {}).get("name", "Incident")
    summary = fields.get("summary", "No Summary")
    description = fields.get("description", "No Description")
    
    issues_count += 1
    issue_key = f"{project_key}-{issues_count}"
    
    print(f"\n[MOCK JIRA] Created Ticket: {issue_key}")
    print(f"Type: {issue_type} | Summary: {summary}")
    print(f"Description:\n{description}\n")
    
    return {
        "id": str(10000 + issues_count),
        "key": issue_key,
        "self": f"http://localhost:8080/rest/api/2/issue/{10000 + issues_count}"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
