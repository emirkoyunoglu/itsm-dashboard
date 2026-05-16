"""
Generate realistic IT incident data matching the Kaggle IT Incident Log Dataset structure.
This creates a CSV file that simulates ServiceNow incident management data.
"""
import csv
import random
import os
from datetime import datetime, timedelta

random.seed(42)

# Configuration
NUM_INCIDENTS = 5000
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "incident_event_log.csv")

# Data pools
INCIDENT_STATES = ["New", "Active", "Awaiting User Info", "Awaiting Problem", 
                   "Awaiting Vendor", "Resolved", "Closed"]
CONTACT_TYPES = ["Phone", "Email", "Self Service", "IVR", "Direct Opening"]
CATEGORIES = ["Software", "Hardware", "Network", "Database", "Inquiry / Help"]
SUBCATEGORIES = {
    "Software": ["Application", "Operating System", "Email", "Office Suite", "ERP"],
    "Hardware": ["Laptop", "Desktop", "Printer", "Monitor", "Peripheral"],
    "Network": ["Connectivity", "VPN", "Firewall", "DNS", "Wireless"],
    "Database": ["Performance", "Access", "Backup", "Replication", "Query"],
    "Inquiry / Help": ["Password Reset", "Account Access", "How To", "Information", "Training"],
}
IMPACT = ["1 - High", "2 - Medium", "3 - Low"]
URGENCY = ["1 - High", "2 - Medium", "3 - Low"]
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
ASSIGNMENT_GROUPS = [
    "Service Desk", "Network Operations", "Database Admin", 
    "Application Support", "Security Operations", "Infrastructure",
    "Cloud Services", "End User Support", "DevOps Team",
    "Data Center Operations"
]
LOCATIONS = [
    "Bandırma HQ", "İzmir Office", "Elazığ Plant", "İstanbul Regional",
    "Ankara Office", "Remote - VPN", "Data Center Alpha", "Data Center Beta"
]
CLOSE_CODES = [
    "Solved (Permanently)", "Solved (Work Around)", "Not Solved (Not Reproducible)",
    "Not Solved (Too Costly)", "Closed/Resolved by Caller"
]
SYMPTOMS = [
    "System Slow", "Service Unavailable", "Error Message", "Cannot Access",
    "Data Loss", "Performance Degradation", "Intermittent Failure",
    "Configuration Error", "Security Alert", "Login Issue"
]

# User pools
CALLERS = [f"Caller{i}" for i in range(1, 201)]
OPENED_BY = [f"Operator{i}" for i in range(1, 31)]
ASSIGNED_TO = [f"Analyst{i}" for i in range(1, 51)]
RESOLVED_BY = [f"Resolver{i}" for i in range(1, 41)]

def generate_incident(incident_num, base_date):
    """Generate a single incident record."""
    # Random open date within a 2-year window
    days_offset = random.randint(0, 730)
    hours_offset = random.randint(0, 23)
    minutes_offset = random.randint(0, 59)
    opened_at = base_date + timedelta(days=days_offset, hours=hours_offset, minutes=minutes_offset)
    
    # System creation is usually within minutes of opening
    sys_created_at = opened_at + timedelta(minutes=random.randint(0, 5))
    
    # Category and subcategory
    category = random.choice(CATEGORIES)
    subcategory = random.choice(SUBCATEGORIES[category])
    
    # Impact and urgency determine priority
    impact = random.choices(IMPACT, weights=[15, 50, 35])[0]
    urgency = random.choices(URGENCY, weights=[10, 45, 45])[0]
    priority = PRIORITY_MATRIX[(impact, urgency)]
    
    # Resolution time depends on priority
    priority_level = int(priority[0])
    # SLA targets by priority (hours)
    sla_targets = {1: 4, 2: 24, 3: 72, 4: 168}
    target = sla_targets[priority_level]
    
    # ~75% of incidents should meet SLA (realistic enterprise target)
    if random.random() < 0.75:
        # Within SLA - resolution within target window
        resolution_hours = round(random.uniform(0.5, target * 0.95), 1)
    else:
        # SLA breached - resolution exceeds target
        resolution_hours = round(random.uniform(target * 1.05, target * 3), 1)
    
    made_sla = resolution_hours <= target
    
    # Determine final state
    is_resolved = random.random() < 0.92
    if is_resolved:
        incident_state = random.choice(["Resolved", "Closed"])
        active = False
        resolved_at = opened_at + timedelta(hours=resolution_hours)
        closed_at = resolved_at + timedelta(hours=random.uniform(0, 48))
    else:
        incident_state = random.choice(["New", "Active", "Awaiting User Info", "Awaiting Vendor"])
        active = True
        resolved_at = None
        closed_at = None
    
    # Reassignment and reopen counts
    reassignment_count = random.choices([0, 1, 2, 3, 4, 5], weights=[40, 25, 15, 10, 7, 3])[0]
    reopen_count = random.choices([0, 1, 2, 3], weights=[75, 15, 7, 3])[0]
    sys_mod_count = random.randint(1, 15) + reassignment_count + reopen_count
    
    # Last update
    if resolved_at:
        sys_updated_at = closed_at if closed_at else resolved_at
    else:
        sys_updated_at = opened_at + timedelta(hours=random.uniform(1, resolution_hours))
    
    incident = {
        "number": f"INC{incident_num:07d}",
        "incident_state": incident_state,
        "active": active,
        "reassignment_count": reassignment_count,
        "reopen_count": reopen_count,
        "sys_mod_count": sys_mod_count,
        "made_sla": made_sla,
        "caller_id": random.choice(CALLERS),
        "opened_by": random.choice(OPENED_BY),
        "opened_at": opened_at.strftime("%Y-%m-%d %H:%M:%S"),
        "sys_created_by": random.choice(OPENED_BY),
        "sys_created_at": sys_created_at.strftime("%Y-%m-%d %H:%M:%S"),
        "sys_updated_by": random.choice(ASSIGNED_TO),
        "sys_updated_at": sys_updated_at.strftime("%Y-%m-%d %H:%M:%S"),
        "contact_type": random.choice(CONTACT_TYPES),
        "location": random.choice(LOCATIONS),
        "category": category,
        "subcategory": subcategory,
        "u_symptom": random.choice(SYMPTOMS),
        "impact": impact,
        "urgency": urgency,
        "priority": priority,
        "assignment_group": random.choice(ASSIGNMENT_GROUPS),
        "assigned_to": random.choice(ASSIGNED_TO),
        "knowledge": random.choice([True, False]),
        "u_priority_confirmation": random.choice([True, False]),
        "notify": random.choices(["Do Not Notify", "Send Email", "Send SMS"], weights=[60, 30, 10])[0],
        "problem_id": f"PRB{random.randint(1, 500):07d}" if random.random() < 0.2 else "",
        "rfc": f"RFC{random.randint(1, 200):07d}" if random.random() < 0.1 else "",
        "vendor": f"Vendor{random.randint(1, 15)}" if random.random() < 0.15 else "",
        "caused_by": "",
        "close_code": random.choice(CLOSE_CODES) if is_resolved else "",
        "resolved_by": random.choice(RESOLVED_BY) if is_resolved else "",
        "resolved_at": resolved_at.strftime("%Y-%m-%d %H:%M:%S") if resolved_at else "",
        "closed_at": closed_at.strftime("%Y-%m-%d %H:%M:%S") if closed_at else "",
    }
    return incident


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    base_date = datetime(2023, 1, 1, 8, 0, 0)
    
    fieldnames = [
        "number", "incident_state", "active", "reassignment_count", "reopen_count",
        "sys_mod_count", "made_sla", "caller_id", "opened_by", "opened_at",
        "sys_created_by", "sys_created_at", "sys_updated_by", "sys_updated_at",
        "contact_type", "location", "category", "subcategory", "u_symptom",
        "impact", "urgency", "priority", "assignment_group", "assigned_to",
        "knowledge", "u_priority_confirmation", "notify", "problem_id", "rfc",
        "vendor", "caused_by", "close_code", "resolved_by", "resolved_at", "closed_at"
    ]
    
    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for i in range(1, NUM_INCIDENTS + 1):
            incident = generate_incident(i, base_date)
            writer.writerow(incident)
    
    print(f"Generated {NUM_INCIDENTS} incidents → {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
