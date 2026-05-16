"""
IT Incident Management Dashboard — Backend API
Flask application serving incident data analytics for the dashboard frontend.
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import csv
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# ─── Constants for CRUD ──────────────────────────────────────────────────────

PRIORITY_MATRIX = {
    ("1 - High", "1 - High"): "1 - Critical",
    ("1 - High", "2 - Medium"): "2 - High",
    ("1 - High", "3 - Low"): "3 - Moderate",
    ("2 - Medium", "1 - High"): "2 - High",
    ("2 - Medium", "2 - Medium"): "3 - Moderate",
    ("2 - Medium", "3 - Low"): "4 - Low",
    ("3 - Low", "1 - High"): "3 - Moderate",
    ("3 - Low", "2 - Medium"): "4 - Low",
    ("3 - Low", "3 - Low"): "4 - Low",
}

SLA_TARGETS = {1: 4, 2: 24, 3: 72, 4: 168}  # hours by priority level

SUBCATEGORIES = {
    "Software": ["Application", "Operating System", "Email", "Office Suite", "ERP"],
    "Hardware": ["Laptop", "Desktop", "Printer", "Monitor", "Peripheral"],
    "Network": ["Connectivity", "VPN", "Firewall", "DNS", "Wireless"],
    "Database": ["Performance", "Access", "Backup", "Replication", "Query"],
    "Inquiry / Help": ["Password Reset", "Account Access", "How To", "Information", "Training"],
}

CSV_FIELDNAMES = [
    "number", "incident_state", "active", "reassignment_count", "reopen_count",
    "sys_mod_count", "made_sla", "caller_id", "opened_by", "opened_at",
    "sys_created_by", "sys_created_at", "sys_updated_by", "sys_updated_at",
    "contact_type", "location", "category", "subcategory", "u_symptom",
    "impact", "urgency", "priority", "assignment_group", "assigned_to",
    "knowledge", "u_priority_confirmation", "notify", "problem_id", "rfc",
    "vendor", "caused_by", "close_code", "resolved_by", "resolved_at", "closed_at"
]

# ─── Data Loading ────────────────────────────────────────────────────────────

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "incident_event_log.csv")

def load_data():
    """Load and preprocess the incident data."""
    df = pd.read_csv(DATA_PATH)
    
    # Parse datetime columns
    datetime_cols = ["opened_at", "sys_created_at", "sys_updated_at", "resolved_at", "closed_at"]
    for col in datetime_cols:
        df[col] = pd.to_datetime(df[col], errors="coerce")
    
    # Calculate resolution time in hours
    df["resolution_hours"] = (df["resolved_at"] - df["opened_at"]).dt.total_seconds() / 3600
    
    # Extract date parts for trend analysis
    df["opened_month"] = df["opened_at"].dt.to_period("M").astype(str)
    df["opened_week"] = df["opened_at"].dt.to_period("W").astype(str)
    df["opened_date"] = df["opened_at"].dt.date.astype(str)
    df["opened_hour"] = df["opened_at"].dt.hour
    df["opened_dayofweek"] = df["opened_at"].dt.dayofweek  # 0=Monday
    
    # Boolean columns
    df["active"] = df["active"].astype(bool)
    df["made_sla"] = df["made_sla"].astype(bool)
    df["knowledge"] = df["knowledge"].astype(bool)
    
    return df

# Load data once at startup
df = load_data()


def filter_by_date(dataframe):
    """Filter dataframe by start_date and end_date query parameters."""
    start = request.args.get("start_date")
    end = request.args.get("end_date")
    filtered = dataframe
    if start:
        filtered = filtered[filtered["opened_at"] >= pd.to_datetime(start)]
    if end:
        filtered = filtered[filtered["opened_at"] <= pd.to_datetime(end) + pd.Timedelta(days=1)]
    return filtered


# ─── API Endpoints ───────────────────────────────────────────────────────────

@app.route("/api/summary", methods=["GET"])
def get_summary():
    """Return high-level KPI summary metrics."""
    fdf = filter_by_date(df)
    total = len(fdf)
    if total == 0:
        return jsonify({"total_incidents": 0, "active_incidents": 0, "resolved_incidents": 0, "avg_resolution_hours": 0, "median_resolution_hours": 0, "sla_compliance_rate": 0, "sla_met_count": 0, "reopen_rate": 0, "reassignment_rate": 0, "knowledge_usage_rate": 0, "priority_breakdown": {}, "monthly_trend": []})
    active_count = int(fdf["active"].sum())
    resolved_count = int((~fdf["active"]).sum())
    
    resolved_df = fdf[fdf["resolution_hours"].notna()]
    avg_resolution = round(resolved_df["resolution_hours"].mean(), 1) if len(resolved_df) > 0 else 0
    median_resolution = round(resolved_df["resolution_hours"].median(), 1) if len(resolved_df) > 0 else 0
    
    sla_met = int(fdf["made_sla"].sum())
    sla_rate = round((sla_met / total) * 100, 1) if total > 0 else 0
    
    priority_counts = fdf["priority"].value_counts().to_dict()
    
    reopened = int((fdf["reopen_count"] > 0).sum())
    reopen_rate = round((reopened / total) * 100, 1)
    
    reassigned = int((fdf["reassignment_count"] > 0).sum())
    reassignment_rate = round((reassigned / total) * 100, 1)
    
    knowledge_used = int(fdf["knowledge"].sum())
    knowledge_rate = round((knowledge_used / total) * 100, 1)
    
    current_month = datetime.now().strftime("%Y-%m")
    completed = fdf[fdf["opened_month"] != current_month]
    month_counts = completed.groupby("opened_month").size()
    if len(month_counts) > 2:
        median_count = month_counts.iloc[:-1].median()
        last_m = month_counts.index[-1]
        if month_counts.iloc[-1] < median_count * 0.5:
            completed = completed[completed["opened_month"] != last_m]
    monthly = completed.groupby("opened_month").size().reset_index(name="count")
    monthly_trend = monthly.tail(12).to_dict("records")
    
    return jsonify({
        "total_incidents": total,
        "active_incidents": active_count,
        "resolved_incidents": resolved_count,
        "avg_resolution_hours": avg_resolution,
        "median_resolution_hours": median_resolution,
        "sla_compliance_rate": sla_rate,
        "sla_met_count": sla_met,
        "reopen_rate": reopen_rate,
        "reassignment_rate": reassignment_rate,
        "knowledge_usage_rate": knowledge_rate,
        "priority_breakdown": priority_counts,
        "monthly_trend": monthly_trend,
    })


@app.route("/api/incidents", methods=["GET"])
def get_incidents():
    """Return paginated, filterable incident list."""
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    search = request.args.get("search", "").strip()
    priority = request.args.get("priority", "")
    category = request.args.get("category", "")
    status = request.args.get("status", "")
    location = request.args.get("location", "")
    sort_by = request.args.get("sort_by", "opened_at")
    sort_order = request.args.get("sort_order", "desc")
    
    filtered = filter_by_date(df)
    
    if search:
        mask = (
            filtered["number"].str.contains(search, case=False, na=False) |
            filtered["caller_id"].str.contains(search, case=False, na=False) |
            filtered["u_symptom"].str.contains(search, case=False, na=False) |
            filtered["category"].str.contains(search, case=False, na=False)
        )
        filtered = filtered[mask]
    
    if priority:
        filtered = filtered[filtered["priority"] == priority]
    if category:
        filtered = filtered[filtered["category"] == category]
    if status:
        filtered = filtered[filtered["incident_state"] == status]
    if location:
        filtered = filtered[filtered["location"] == location]
    
    total = len(filtered)
    
    # Sort
    ascending = sort_order == "asc"
    if sort_by in filtered.columns:
        filtered = filtered.sort_values(sort_by, ascending=ascending, na_position="last")
    
    # Paginate
    start = (page - 1) * per_page
    end = start + per_page
    page_data = filtered.iloc[start:end]
    
    # Select display columns
    display_cols = [
        "number", "incident_state", "priority", "category", "subcategory",
        "u_symptom", "impact", "urgency", "assignment_group", "assigned_to",
        "location", "contact_type", "made_sla", "reassignment_count",
        "reopen_count", "opened_at", "resolved_at", "resolution_hours"
    ]
    
    records = []
    for _, row in page_data.iterrows():
        record = {}
        for col in display_cols:
            val = row[col]
            if pd.isna(val):
                record[col] = None
            elif isinstance(val, pd.Timestamp):
                record[col] = val.strftime("%Y-%m-%d %H:%M")
            elif isinstance(val, bool):
                record[col] = val
            else:
                record[col] = val
        records.append(record)
    
    return jsonify({
        "incidents": records,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    })


@app.route("/api/trends", methods=["GET"])
def get_trends():
    """Return time-based trend data for incident volume and resolution.
    Excludes the current (incomplete) month to avoid misleading partial data."""
    granularity = request.args.get("granularity", "monthly")  # daily, weekly, monthly
    
    if granularity == "daily":
        group_col = "opened_date"
    elif granularity == "weekly":
        group_col = "opened_week"
    else:
        group_col = "opened_month"
    
    # Exclude current (incomplete) month for monthly granularity
    # Also exclude the last month in data if it has significantly fewer incidents (partial data)
    working_df = filter_by_date(df)
    if granularity == "monthly":
        current_month = datetime.now().strftime("%Y-%m")
        working_df = working_df[working_df["opened_month"] != current_month]
        
        # Check if the last month in data is incomplete (< 50% of median)
        month_counts = working_df.groupby("opened_month").size()
        if len(month_counts) > 2:
            median_count = month_counts.iloc[:-1].median()
            last_month = month_counts.index[-1]
            if month_counts.iloc[-1] < median_count * 0.5:
                working_df = working_df[working_df["opened_month"] != last_month]
    
    # Incident volume trend
    volume = working_df.groupby(group_col).size().reset_index(name="count")
    
    # SLA compliance trend
    sla = working_df.groupby(group_col)["made_sla"].mean().reset_index()
    sla["made_sla"] = (sla["made_sla"] * 100).round(1)
    sla.columns = [group_col, "sla_rate"]
    
    # Average resolution time trend
    resolution = working_df.groupby(group_col)["resolution_hours"].mean().reset_index()
    resolution["resolution_hours"] = resolution["resolution_hours"].round(1)
    
    # Merge all trends
    merged = volume.merge(sla, on=group_col, how="left").merge(resolution, on=group_col, how="left")
    merged.columns = ["period", "incident_count", "sla_rate", "avg_resolution_hours"]
    merged = merged.fillna(0)
    
    return jsonify(merged.to_dict("records"))


@app.route("/api/priority-distribution", methods=["GET"])
def get_priority_distribution():
    """Return priority distribution data."""
    fdf = filter_by_date(df)
    dist = fdf["priority"].value_counts().reset_index()
    dist.columns = ["priority", "count"]
    
    sla_by_priority = fdf.groupby("priority")["made_sla"].mean().reset_index()
    sla_by_priority["made_sla"] = (sla_by_priority["made_sla"] * 100).round(1)
    sla_by_priority.columns = ["priority", "sla_rate"]
    
    merged = dist.merge(sla_by_priority, on="priority", how="left")
    
    return jsonify(merged.to_dict("records"))


@app.route("/api/category-analysis", methods=["GET"])
def get_category_analysis():
    """Return category-based incident analysis."""
    fdf = filter_by_date(df)
    cat_counts = fdf.groupby(["category", "subcategory"]).agg(
        count=("number", "size"),
        avg_resolution=("resolution_hours", "mean"),
        sla_rate=("made_sla", "mean"),
    ).reset_index()
    
    cat_counts["avg_resolution"] = cat_counts["avg_resolution"].round(1)
    cat_counts["sla_rate"] = (cat_counts["sla_rate"] * 100).round(1)
    
    cat_summary = fdf.groupby("category").agg(
        count=("number", "size"),
        avg_resolution=("resolution_hours", "mean"),
        sla_rate=("made_sla", "mean"),
    ).reset_index()
    cat_summary["avg_resolution"] = cat_summary["avg_resolution"].round(1)
    cat_summary["sla_rate"] = (cat_summary["sla_rate"] * 100).round(1)
    
    return jsonify({
        "categories": cat_summary.to_dict("records"),
        "subcategories": cat_counts.to_dict("records"),
    })


@app.route("/api/sla-performance", methods=["GET"])
def get_sla_performance():
    """Return SLA performance metrics."""
    fdf = filter_by_date(df)
    total = len(fdf)
    met = int(fdf["made_sla"].sum())
    breached = total - met
    
    sla_priority = fdf.groupby("priority").agg(
        total=("number", "size"),
        met=("made_sla", "sum"),
    ).reset_index()
    sla_priority["breached"] = sla_priority["total"] - sla_priority["met"]
    sla_priority["rate"] = (sla_priority["met"] / sla_priority["total"] * 100).round(1)
    
    sla_group = fdf.groupby("assignment_group").agg(
        total=("number", "size"),
        met=("made_sla", "sum"),
        avg_resolution=("resolution_hours", "mean"),
    ).reset_index()
    sla_group["rate"] = (sla_group["met"] / sla_group["total"] * 100).round(1)
    sla_group["avg_resolution"] = sla_group["avg_resolution"].round(1)
    
    sla_location = fdf.groupby("location").agg(
        total=("number", "size"),
        met=("made_sla", "sum"),
    ).reset_index()
    sla_location["rate"] = (sla_location["met"] / sla_location["total"] * 100).round(1)
    
    return jsonify({
        "overall": {"total": total, "met": int(met), "breached": breached, "rate": round(met / total * 100, 1)},
        "by_priority": sla_priority.to_dict("records"),
        "by_group": sla_group.to_dict("records"),
        "by_location": sla_location.to_dict("records"),
    })


@app.route("/api/assignment-groups", methods=["GET"])
def get_assignment_groups():
    """Return assignment group performance data."""
    fdf = filter_by_date(df)
    group_data = fdf.groupby("assignment_group").agg(
        total_incidents=("number", "size"),
        active_incidents=("active", "sum"),
        avg_resolution_hours=("resolution_hours", "mean"),
        median_resolution_hours=("resolution_hours", "median"),
        sla_compliance=("made_sla", "mean"),
        avg_reassignments=("reassignment_count", "mean"),
        avg_reopens=("reopen_count", "mean"),
    ).reset_index()
    
    group_data["avg_resolution_hours"] = group_data["avg_resolution_hours"].round(1)
    group_data["median_resolution_hours"] = group_data["median_resolution_hours"].round(1)
    group_data["sla_compliance"] = (group_data["sla_compliance"] * 100).round(1)
    group_data["avg_reassignments"] = group_data["avg_reassignments"].round(2)
    group_data["avg_reopens"] = group_data["avg_reopens"].round(2)
    group_data["active_incidents"] = group_data["active_incidents"].astype(int)
    
    group_data = group_data.sort_values("total_incidents", ascending=False)
    
    return jsonify(group_data.to_dict("records"))


@app.route("/api/resolution-analysis", methods=["GET"])
def get_resolution_analysis():
    """Return resolution time analysis data."""
    fdf = filter_by_date(df)
    resolved = fdf[fdf["resolution_hours"].notna()].copy()
    
    bins = [0, 1, 4, 8, 24, 48, 72, 168, 336, float("inf")]
    labels = ["<1h", "1-4h", "4-8h", "8-24h", "1-2d", "2-3d", "3-7d", "7-14d", ">14d"]
    resolved["time_bucket"] = pd.cut(resolved["resolution_hours"], bins=bins, labels=labels)
    histogram = resolved["time_bucket"].value_counts().sort_index().reset_index()
    histogram.columns = ["bucket", "count"]
    
    close_codes = resolved["close_code"].value_counts().reset_index()
    close_codes.columns = ["close_code", "count"]
    
    contact = fdf.groupby("contact_type").agg(
        count=("number", "size"),
        avg_resolution=("resolution_hours", "mean"),
    ).reset_index()
    contact["avg_resolution"] = contact["avg_resolution"].round(1)
    
    return jsonify({
        "histogram": histogram.to_dict("records"),
        "close_codes": close_codes.to_dict("records"),
        "by_contact_type": contact.to_dict("records"),
    })


@app.route("/api/heatmap", methods=["GET"])
def get_heatmap():
    """Return hour/day heatmap data for incident volume."""
    fdf = filter_by_date(df)
    heatmap = fdf.groupby(["opened_dayofweek", "opened_hour"]).size().reset_index(name="count")
    heatmap.columns = ["day", "hour", "count"]
    
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    heatmap["day_name"] = heatmap["day"].map(lambda x: day_names[x])
    
    return jsonify(heatmap.to_dict("records"))


@app.route("/api/filters", methods=["GET"])
def get_filters():
    """Return available filter options."""
    return jsonify({
        "priorities": sorted(df["priority"].unique().tolist()),
        "categories": sorted(df["category"].unique().tolist()),
        "statuses": sorted(df["incident_state"].unique().tolist()),
        "locations": sorted(df["location"].unique().tolist()),
        "assignment_groups": sorted(df["assignment_group"].unique().tolist()),
        "date_range": {
            "min": df["opened_at"].min().strftime("%Y-%m-%d"),
            "max": df["opened_at"].max().strftime("%Y-%m-%d"),
        },
    })


@app.route("/api/reports/executive-summary", methods=["GET"])
def get_executive_summary():
    """Return executive summary report data."""
    fdf = filter_by_date(df)
    total = len(fdf)
    resolved = fdf[~fdf["active"]]
    active = fdf[fdf["active"]]
    
    # Monthly comparisons — exclude current incomplete month
    current_month = datetime.now().strftime("%Y-%m")
    completed_df = fdf[fdf["opened_month"] != current_month]
    # Exclude last month if incomplete (< 50% of median)
    mc = completed_df.groupby("opened_month").size()
    if len(mc) > 2:
        med = mc.iloc[:-1].median()
        last_m = mc.index[-1]
        if mc.iloc[-1] < med * 0.5:
            completed_df = completed_df[completed_df["opened_month"] != last_m]
    monthly = completed_df.groupby("opened_month").agg(
        incidents=("number", "size"),
        resolved=("active", lambda x: int((~x).sum())),
        sla_rate=("made_sla", "mean"),
        avg_resolution=("resolution_hours", "mean"),
        reopened=("reopen_count", lambda x: int((x > 0).sum())),
    ).reset_index()
    monthly["sla_rate"] = (monthly["sla_rate"] * 100).round(1)
    monthly["avg_resolution"] = monthly["avg_resolution"].round(1)
    
    # Top issues
    top_categories = fdf["category"].value_counts().head(5).reset_index()
    top_categories.columns = ["category", "count"]
    
    top_symptoms = fdf["u_symptom"].value_counts().head(5).reset_index()
    top_symptoms.columns = ["symptom", "count"]
    
    team_perf = fdf.groupby("assignment_group").agg(
        incidents=("number", "size"),
        sla_rate=("made_sla", "mean"),
        avg_resolution=("resolution_hours", "mean"),
    ).reset_index()
    team_perf["sla_rate"] = (team_perf["sla_rate"] * 100).round(1)
    team_perf["avg_resolution"] = team_perf["avg_resolution"].round(1)
    team_perf = team_perf.sort_values("sla_rate", ascending=False)
    
    # Insights & action items (auto-generated)
    locale = request.args.get("locale", "tr")
    worst_sla_group = team_perf.iloc[-1]
    best_sla_group = team_perf.iloc[0]
    critical_count = int(fdf[fdf["priority"] == "1 - Critical"].shape[0])
    high_reopen = fdf[fdf["reopen_count"] > 1].shape[0]
    
    if locale == "tr":
        insights = [
            {
                "type": "warning",
                "title": "SLA Uyum Uyarısı",
                "description": f"{worst_sla_group['assignment_group']} ekibi %{worst_sla_group['sla_rate']} ile en düşük SLA uyumuna sahip. Aksiyon planı gerekli."
            },
            {
                "type": "success", 
                "title": "En Başarılı Ekip",
                "description": f"{best_sla_group['assignment_group']} ekibi %{best_sla_group['sla_rate']} SLA uyumu ve {best_sla_group['avg_resolution']}s ortalama çözüm süresi ile lider."
            },
            {
                "type": "info",
                "title": "Kritik Olaylar",
                "description": f"{critical_count} kritik olay kaydı (toplamın %{round(critical_count/total*100, 1)}'i). Tekrarlayan örüntüleri izleyin."
            },
            {
                "type": "warning",
                "title": "Yüksek Tekrar Açılma Oranı",
                "description": f"{high_reopen} olay birden fazla kez yeniden açıldı. Kök neden analizi sürecini gözden geçirin."
            },
        ]
    else:
        insights = [
            {
                "type": "warning",
                "title": "SLA Compliance Alert",
                "description": f"{worst_sla_group['assignment_group']} has the lowest SLA compliance at {worst_sla_group['sla_rate']}%. Action plan needed."
            },
            {
                "type": "success", 
                "title": "Top Performing Team",
                "description": f"{best_sla_group['assignment_group']} leads with {best_sla_group['sla_rate']}% SLA compliance and {best_sla_group['avg_resolution']}h avg resolution."
            },
            {
                "type": "info",
                "title": "Critical Incidents",
                "description": f"{critical_count} critical incidents recorded ({round(critical_count/total*100, 1)}% of total). Monitor for recurring patterns."
            },
            {
                "type": "warning",
                "title": "High Reopen Rate",
                "description": f"{high_reopen} incidents reopened more than once. Review root cause analysis process."
            },
        ]
    
    return jsonify({
        "overview": {
            "total_incidents": total,
            "resolved_count": len(resolved),
            "active_count": len(active),
            "resolution_rate": round(len(resolved) / total * 100, 1),
            "overall_sla": round(fdf["made_sla"].mean() * 100, 1),
            "avg_resolution": round(fdf["resolution_hours"].mean(), 1),
        },
        "monthly_data": monthly.to_dict("records"),
        "top_categories": top_categories.to_dict("records"),
        "top_symptoms": top_symptoms.to_dict("records"),
        "team_performance": team_perf.to_dict("records"),
        "insights": insights,
    })


# ─── CRUD Endpoints ─────────────────────────────────────────────────────────

def save_to_csv():
    """Persist the current DataFrame back to CSV."""
    df.to_csv(DATA_PATH, index=False, columns=CSV_FIELDNAMES)


def next_incident_number():
    """Generate the next INC number."""
    nums = df["number"].str.extract(r"INC(\d+)")[0].astype(int)
    return f"INC{nums.max() + 1:07d}"


@app.route("/api/subcategories", methods=["GET"])
def get_subcategories():
    """Return subcategory mapping for forms."""
    return jsonify(SUBCATEGORIES)


@app.route("/api/incidents/<number>", methods=["GET"])
def get_incident_detail(number):
    """Return single incident detail."""
    row = df[df["number"] == number]
    if row.empty:
        return jsonify({"error": "Incident not found"}), 404
    record = row.iloc[0].to_dict()
    # Convert timestamps to strings
    for col in ["opened_at", "sys_created_at", "sys_updated_at", "resolved_at", "closed_at"]:
        val = record.get(col)
        if pd.notna(val) and hasattr(val, "isoformat"):
            record[col] = val.isoformat()
        elif pd.isna(val):
            record[col] = None
    # Convert numpy types
    for k, v in record.items():
        if hasattr(v, "item"):
            record[k] = v.item()
        if isinstance(v, float) and pd.isna(v):
            record[k] = None
    return jsonify(record)


@app.route("/api/incidents", methods=["POST"])
def create_incident():
    """Create a new incident."""
    global df
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    now = datetime.now()
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")

    impact = data.get("impact", "2 - Medium")
    urgency = data.get("urgency", "2 - Medium")
    priority = PRIORITY_MATRIX.get((impact, urgency), "3 - Moderate")

    inc_number = next_incident_number()

    new_row = {
        "number": inc_number,
        "incident_state": "New",
        "active": True,
        "reassignment_count": 0,
        "reopen_count": 0,
        "sys_mod_count": 1,
        "made_sla": True,
        "caller_id": data.get("caller_id", ""),
        "opened_by": data.get("opened_by", "Dashboard User"),
        "opened_at": now_str,
        "sys_created_by": "Dashboard User",
        "sys_created_at": now_str,
        "sys_updated_by": "Dashboard User",
        "sys_updated_at": now_str,
        "contact_type": data.get("contact_type", "Self Service"),
        "location": data.get("location", ""),
        "category": data.get("category", ""),
        "subcategory": data.get("subcategory", ""),
        "u_symptom": data.get("u_symptom", ""),
        "impact": impact,
        "urgency": urgency,
        "priority": priority,
        "assignment_group": data.get("assignment_group", ""),
        "assigned_to": data.get("assigned_to", ""),
        "knowledge": False,
        "u_priority_confirmation": False,
        "notify": "Send Email",
        "problem_id": "",
        "rfc": "",
        "vendor": "",
        "caused_by": "",
        "close_code": "",
        "resolved_by": "",
        "resolved_at": "",
        "closed_at": "",
    }

    # Append to DataFrame
    new_df_row = pd.DataFrame([new_row])
    for col in ["opened_at", "sys_created_at", "sys_updated_at"]:
        new_df_row[col] = pd.to_datetime(new_df_row[col])
    for col in ["resolved_at", "closed_at"]:
        new_df_row[col] = pd.NaT
    new_df_row["active"] = True
    new_df_row["made_sla"] = True
    new_df_row["knowledge"] = False
    new_df_row["resolution_hours"] = pd.NA
    new_df_row["opened_month"] = now.strftime("%Y-%m")
    new_df_row["opened_week"] = str(pd.Timestamp(now).to_period("W"))
    new_df_row["opened_date"] = now.strftime("%Y-%m-%d")
    new_df_row["opened_hour"] = now.hour
    new_df_row["opened_dayofweek"] = now.weekday()

    df = pd.concat([df, new_df_row], ignore_index=True)
    save_to_csv()

    return jsonify({"message": "Incident created", "number": inc_number}), 201


@app.route("/api/incidents/<number>", methods=["PUT"])
def update_incident(number):
    """Update an existing incident."""
    global df
    idx = df.index[df["number"] == number]
    if idx.empty:
        return jsonify({"error": "Incident not found"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    i = idx[0]
    updatable = ["category", "subcategory", "u_symptom", "impact", "urgency",
                 "assignment_group", "assigned_to", "location", "contact_type",
                 "caller_id", "incident_state", "knowledge"]

    for field in updatable:
        if field in data:
            df.at[i, field] = data[field]

    # Recalculate priority if impact/urgency changed
    if "impact" in data or "urgency" in data:
        imp = df.at[i, "impact"]
        urg = df.at[i, "urgency"]
        df.at[i, "priority"] = PRIORITY_MATRIX.get((imp, urg), "3 - Moderate")

    # Update active flag based on state
    if "incident_state" in data:
        state = data["incident_state"]
        df.at[i, "active"] = state not in ("Resolved", "Closed")

    df.at[i, "sys_updated_at"] = pd.Timestamp.now()
    df.at[i, "sys_updated_by"] = "Dashboard User"
    df.at[i, "sys_mod_count"] = int(df.at[i, "sys_mod_count"]) + 1

    save_to_csv()
    return jsonify({"message": "Incident updated", "number": number})


@app.route("/api/incidents/<number>/resolve", methods=["POST"])
def resolve_incident(number):
    """Resolve an incident."""
    global df
    idx = df.index[df["number"] == number]
    if idx.empty:
        return jsonify({"error": "Incident not found"}), 404

    data = request.get_json() or {}
    i = idx[0]
    now = pd.Timestamp.now()

    df.at[i, "incident_state"] = "Resolved"
    df.at[i, "active"] = False
    df.at[i, "resolved_at"] = now
    df.at[i, "resolved_by"] = data.get("resolved_by", "Dashboard User")
    df.at[i, "close_code"] = data.get("close_code", "Solved (Permanently)")
    df.at[i, "sys_updated_at"] = now
    df.at[i, "sys_updated_by"] = "Dashboard User"

    # Calculate resolution hours and SLA
    opened = df.at[i, "opened_at"]
    if pd.notna(opened):
        hours = (now - pd.Timestamp(opened)).total_seconds() / 3600
        df.at[i, "resolution_hours"] = round(hours, 1)
        prio_level = int(str(df.at[i, "priority"])[0])
        target = SLA_TARGETS.get(prio_level, 72)
        df.at[i, "made_sla"] = hours <= target

    save_to_csv()
    return jsonify({"message": "Incident resolved", "number": number})


# ─── Run ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, port=5000)
