"""
IT Incident Management Dashboard — Backend API
Flask application serving incident data analytics for the dashboard frontend.
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

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


# ─── API Endpoints ───────────────────────────────────────────────────────────

@app.route("/api/summary", methods=["GET"])
def get_summary():
    """Return high-level KPI summary metrics."""
    total = len(df)
    active_count = int(df["active"].sum())
    resolved_count = int((~df["active"]).sum())
    
    resolved_df = df[df["resolution_hours"].notna()]
    avg_resolution = round(resolved_df["resolution_hours"].mean(), 1) if len(resolved_df) > 0 else 0
    median_resolution = round(resolved_df["resolution_hours"].median(), 1) if len(resolved_df) > 0 else 0
    
    sla_met = int(df["made_sla"].sum())
    sla_rate = round((sla_met / total) * 100, 1) if total > 0 else 0
    
    # Priority breakdown
    priority_counts = df["priority"].value_counts().to_dict()
    
    # Reopen & reassignment rates
    reopened = int((df["reopen_count"] > 0).sum())
    reopen_rate = round((reopened / total) * 100, 1)
    
    reassigned = int((df["reassignment_count"] > 0).sum())
    reassignment_rate = round((reassigned / total) * 100, 1)
    
    # Knowledge usage
    knowledge_used = int(df["knowledge"].sum())
    knowledge_rate = round((knowledge_used / total) * 100, 1)
    
    # Monthly incident count for sparkline (exclude current incomplete month)
    current_month = datetime.now().strftime("%Y-%m")
    completed = df[df["opened_month"] != current_month]
    # Also exclude last month if it's incomplete (< 50% of median)
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
    
    filtered = df.copy()
    
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
    working_df = df.copy()
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
    dist = df["priority"].value_counts().reset_index()
    dist.columns = ["priority", "count"]
    
    # Also get SLA compliance by priority
    sla_by_priority = df.groupby("priority")["made_sla"].mean().reset_index()
    sla_by_priority["made_sla"] = (sla_by_priority["made_sla"] * 100).round(1)
    sla_by_priority.columns = ["priority", "sla_rate"]
    
    merged = dist.merge(sla_by_priority, on="priority", how="left")
    
    return jsonify(merged.to_dict("records"))


@app.route("/api/category-analysis", methods=["GET"])
def get_category_analysis():
    """Return category-based incident analysis."""
    cat_counts = df.groupby(["category", "subcategory"]).agg(
        count=("number", "size"),
        avg_resolution=("resolution_hours", "mean"),
        sla_rate=("made_sla", "mean"),
    ).reset_index()
    
    cat_counts["avg_resolution"] = cat_counts["avg_resolution"].round(1)
    cat_counts["sla_rate"] = (cat_counts["sla_rate"] * 100).round(1)
    
    # Category level summary
    cat_summary = df.groupby("category").agg(
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
    # Overall SLA
    total = len(df)
    met = int(df["made_sla"].sum())
    breached = total - met
    
    # SLA by priority
    sla_priority = df.groupby("priority").agg(
        total=("number", "size"),
        met=("made_sla", "sum"),
    ).reset_index()
    sla_priority["breached"] = sla_priority["total"] - sla_priority["met"]
    sla_priority["rate"] = (sla_priority["met"] / sla_priority["total"] * 100).round(1)
    
    # SLA by assignment group
    sla_group = df.groupby("assignment_group").agg(
        total=("number", "size"),
        met=("made_sla", "sum"),
        avg_resolution=("resolution_hours", "mean"),
    ).reset_index()
    sla_group["rate"] = (sla_group["met"] / sla_group["total"] * 100).round(1)
    sla_group["avg_resolution"] = sla_group["avg_resolution"].round(1)
    
    # SLA by location
    sla_location = df.groupby("location").agg(
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
    group_data = df.groupby("assignment_group").agg(
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
    resolved = df[df["resolution_hours"].notna()].copy()
    
    # Resolution time distribution (histogram buckets)
    bins = [0, 1, 4, 8, 24, 48, 72, 168, 336, float("inf")]
    labels = ["<1h", "1-4h", "4-8h", "8-24h", "1-2d", "2-3d", "3-7d", "7-14d", ">14d"]
    resolved["time_bucket"] = pd.cut(resolved["resolution_hours"], bins=bins, labels=labels)
    histogram = resolved["time_bucket"].value_counts().sort_index().reset_index()
    histogram.columns = ["bucket", "count"]
    
    # Close code distribution
    close_codes = resolved["close_code"].value_counts().reset_index()
    close_codes.columns = ["close_code", "count"]
    
    # Contact type analysis
    contact = df.groupby("contact_type").agg(
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
    heatmap = df.groupby(["opened_dayofweek", "opened_hour"]).size().reset_index(name="count")
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
    })


@app.route("/api/reports/executive-summary", methods=["GET"])
def get_executive_summary():
    """Return executive summary report data."""
    total = len(df)
    resolved = df[~df["active"]]
    active = df[df["active"]]
    
    # Monthly comparisons — exclude current incomplete month
    current_month = datetime.now().strftime("%Y-%m")
    completed_df = df[df["opened_month"] != current_month]
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
    top_categories = df["category"].value_counts().head(5).reset_index()
    top_categories.columns = ["category", "count"]
    
    top_symptoms = df["u_symptom"].value_counts().head(5).reset_index()
    top_symptoms.columns = ["symptom", "count"]
    
    # Team performance ranking
    team_perf = df.groupby("assignment_group").agg(
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
    critical_count = int(df[df["priority"] == "1 - Critical"].shape[0])
    high_reopen = df[df["reopen_count"] > 1].shape[0]
    
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
            "overall_sla": round(df["made_sla"].mean() * 100, 1),
            "avg_resolution": round(df["resolution_hours"].mean(), 1),
        },
        "monthly_data": monthly.to_dict("records"),
        "top_categories": top_categories.to_dict("records"),
        "top_symptoms": top_symptoms.to_dict("records"),
        "team_performance": team_perf.to_dict("records"),
        "insights": insights,
    })


# ─── Run ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, port=5000)
