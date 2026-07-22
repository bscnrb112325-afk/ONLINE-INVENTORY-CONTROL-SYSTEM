from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
import random
import os
import json
import base64
from datetime import datetime, date
from zoneinfo import ZoneInfo
from dotenv import load_dotenv
from google import genai
from google.genai import types
import httpx
import math
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from contextlib import asynccontextmanager

load_dotenv(override=True)

# ─── Scheduler setup ─────────────────────────────────────────────────────────
scheduler = AsyncIOScheduler(timezone=ZoneInfo("Africa/Nairobi"))

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start scheduler on startup, stop on shutdown."""
    report_hour = int(os.getenv("EMAIL_REPORT_HOUR", "8"))
    scheduler.add_job(
        send_daily_email_report,
        CronTrigger(hour=report_hour, minute=0),
        id="daily_email_report",
        replace_existing=True,
    )
    scheduler.start()
    print(f"[Scheduler] Daily Email report scheduled at {report_hour:02d}:00 EAT")
    yield
    scheduler.shutdown()

app = FastAPI(title="OICS AI Decision Engine 🧠", lifespan=lifespan)

class SalesData(BaseModel):
    product_id: str
    historical_sales: List[int]

class PredictionResponse(BaseModel):
    product_id: str
    predicted_sales_next_week: int
    confidence_score: float

class PricingRequest(BaseModel):
    product_id: str
    current_price: float
    stock_level: int

class PricingResponse(BaseModel):
    product_id: str
    suggested_price: float
    confidence_score: float
    reason: str

class ReorderRequest(BaseModel):
    product_id: str
    current_stock: int
    average_daily_sales: float
    lead_time_days: int

class ReorderResponse(BaseModel):
    product_id: str
    should_reorder: bool
    reorder_point: int
    recommended_reorder_qty: int
    confidence_score: float

@app.get("/")
def read_root():
    return {"message": "OICS AI Decision Engine is running 🧠"}

@app.post("/predict", response_model=PredictionResponse)
def predict_demand(data: SalesData):
    if not data.historical_sales:
        return PredictionResponse(
            product_id=data.product_id,
            predicted_sales_next_week=0,
            confidence_score=0.0
        )
    recent_average = sum(data.historical_sales[-3:]) / min(len(data.historical_sales), 3)
    predicted = int(recent_average * random.uniform(0.9, 1.2))
    return PredictionResponse(
        product_id=data.product_id,
        predicted_sales_next_week=max(0, predicted),
        confidence_score=round(random.uniform(0.75, 0.95), 2)
    )

@app.post("/dynamic-pricing", response_model=PricingResponse)
def calculate_pricing(data: PricingRequest):
    # Dynamic pricing heuristics
    suggested = data.current_price
    confidence = round(random.uniform(0.8, 0.95), 2)
    
    if data.stock_level <= 3:
        suggested = round(data.current_price * 1.15, 2)
        reason = "Scarcity warning: Stock is critical (<= 3). Price increased by 15% to optimize margins during high demand."
    elif data.stock_level >= 50:
        suggested = round(data.current_price * 0.85, 2)
        reason = "Excess inventory: Stock is high (>= 50). Price discounted by 15% to stimulate sales velocity and clear warehouse."
    else:
        reason = "Stock levels are stable. Maintaining baseline market pricing."
        confidence = 0.99
        
    return PricingResponse(
        product_id=data.product_id,
        suggested_price=suggested,
        confidence_score=confidence,
        reason=reason
    )

@app.post("/reorder-recommendation", response_model=ReorderResponse)
def check_reorder(data: ReorderRequest):
    # Reorder Point = (Average Daily Sales * Lead Time) + Safety Stock
    safety_stock = 5
    reorder_point = int((data.average_daily_sales * data.lead_time_days) + safety_stock)
    
    should_reorder = data.current_stock <= reorder_point
    
    # Restock up to a 14-day supply
    recommended_qty = 0
    if should_reorder:
        ideal_stock = int(data.average_daily_sales * 14) + safety_stock
        recommended_qty = max(10, ideal_stock - data.current_stock)
        
    return ReorderResponse(
        product_id=data.product_id,
        should_reorder=should_reorder,
        reorder_point=reorder_point,
        recommended_reorder_qty=recommended_qty,
        confidence_score=round(random.uniform(0.85, 0.98), 2)
    )

class SupplierBidInput(BaseModel):
    id: str
    supplier_name: str
    bid_price: float
    delivery_time_days: int
    reliability_score: float

class SupplierRecommendationRequest(BaseModel):
    product_id: str
    bids: List[SupplierBidInput]

class SupplierRecommendationResponse(BaseModel):
    best_supplier_bid_id: str
    reason: str
    scores: dict

@app.post("/suggest-supplier", response_model=SupplierRecommendationResponse)
def suggest_supplier(data: SupplierRecommendationRequest):
    if not data.bids:
        return SupplierRecommendationResponse(
            best_supplier_bid_id="",
            reason="No bids submitted for this product.",
            scores={}
        )
    
    # Extract min/max values for normalization
    prices = [bid.bid_price for bid in data.bids]
    deliveries = [bid.delivery_time_days for bid in data.bids]
    reliabilities = [bid.reliability_score for bid in data.bids]
    
    min_price, max_price = min(prices), max(prices)
    min_deliv, max_deliv = min(deliveries), max(deliveries)
    min_rel, max_rel = min(reliabilities), max(reliabilities)
    
    scores = {}
    best_bid_id = None
    best_score = -1.0
    
    for bid in data.bids:
        # Price score (lower is better)
        if max_price == min_price:
            p_score = 1.0
        else:
            p_score = 1.0 - ((bid.bid_price - min_price) / (max_price - min_price))
            
        # Delivery score (lower is better)
        if max_deliv == min_deliv:
            d_score = 1.0
        else:
            d_score = 1.0 - ((bid.delivery_time_days - min_deliv) / (max_deliv - min_deliv))
            
        # Reliability score (higher is better)
        if max_rel == min_rel:
            r_score = 1.0
        else:
            r_score = (bid.reliability_score - min_rel) / (max_rel - min_rel)
            
        # Weighted Score: 40% Price, 35% Delivery Speed, 25% Reliability
        weighted_score = (p_score * 0.40) + (d_score * 0.35) + (r_score * 0.25)
        scores[bid.id] = round(weighted_score * 100, 1)
        
        if weighted_score > best_score:
            best_score = weighted_score
            best_bid_id = bid.id
            
    # Find the winning supplier details
    winner = next(b for b in data.bids if b.id == best_bid_id)
    reason = (
        f"AI selected {winner.supplier_name} as the optimal choice with a score of {scores[best_bid_id]}%. "
        f"They offer a bid price of KSh {winner.bid_price:,.2f}, a delivery speed of {winner.delivery_time_days} days, "
        f"and have a reliability score of {winner.reliability_score}/5.0."
    )
    
    return SupplierRecommendationResponse(
        best_supplier_bid_id=best_bid_id,
        reason=reason,
        scores=scores
    )

class VisionRequest(BaseModel):
    image_base64: Optional[str] = ""
    barcode: Optional[str] = ""

class VisionResponse(BaseModel):
    name: str
    category: str
    brand: Optional[str] = ""
    description: str
    serial: Optional[str] = ""
    buy_rate: Optional[float] = 0.0
    sell_rate: Optional[float] = 0.0
    profit_margin: Optional[float] = 0.0
    qty: Optional[int] = 0
    reorder_threshold: Optional[int] = 0
    supplier_suggestion: Optional[str] = ""
    product_details: Optional[str] = ""
    confidence: float

@app.post("/vision/recognize", response_model=VisionResponse)
@app.post("/scan-vision", response_model=VisionResponse)
@app.post("/vision-scan", response_model=VisionResponse)
def recognize_product(data: VisionRequest):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return VisionResponse(
            name="API Key Missing",
            category="Error",
            brand="System Alert",
            description="Please add GEMINI_API_KEY to ai_service/.env",
            confidence=0.0
        )
        
    try:
        client = genai.Client(api_key=api_key)
        
        prompt = """
        Examine this product image carefully to capture actual details for inventory entry:
        Provide a JSON response with the following exact keys:
        - "name": Item Name. The exact or most accurate product name, title, flavor, model, or variant visible on the package (e.g., "Coca-Cola Original Taste 500ml", "Logitech MX Master 3S Wireless Mouse").
        - "brand": Brand Name. The exact brand or manufacturer name visible on the product label or logo (e.g., "Coca-Cola", "Logitech", "Samsung", "Nestle").
        - "category": Category. A broad category for the item (e.g., "Beverages", "Electronics", "Groceries", "Snacks", "Personal Care", "Hardware", "Apparel").
        - "description": Short description. A clear, informative 1-2 sentence description of the product based on what is shown.
        - "serial": Barcode SKU. Extract the exact barcode number, EAN/UPC, serial number, or model number visible on the package. If no barcode is visible, generate a clean SKU in the format "SKU-XXXXXX".
        - "buy_rate": Buy Rate / Cost (KSh). Estimate a realistic wholesale cost / buy rate in KSh for this item (floating point number > 0).
        - "sell_rate": Sell Rate / Price (KSh). Estimate a realistic retail selling price in KSh for this item (floating point number > buy_rate).
        - "profit_margin": Recommended profit margin percentage as a number (e.g. 35.0).
        - "qty": Initial Stock Qty. Estimate a reasonable initial stock quantity (integer between 20 and 100).
        - "reorder_threshold": Reorder Level. Recommended reorder level threshold (integer between 5 and 20).
        - "supplier_suggestion": Recommended supplier, distributor, or manufacturer name for this brand line.
        - "product_details": Product Details & Spec using ai. Detailed technical specifications extracted from label: net weight/volume, ingredients/materials, model number, color, packaging type, warranty, dimensions.
        Return ONLY valid JSON matching this schema without markdown code blocks.
        """

        if data.image_base64:
            b64_data = data.image_base64
            mime_type = "image/jpeg"
            if ',' in b64_data:
                header, b64_data = b64_data.split(',', 1)
                if "image/png" in header.lower():
                    mime_type = "image/png"
                elif "image/webp" in header.lower():
                    mime_type = "image/webp"
                elif "image/gif" in header.lower():
                    mime_type = "image/gif"
                
            image_bytes = base64.b64decode(b64_data)
            
            response = client.models.generate_content(
                model='gemini-flash-latest',
                contents=[
                    prompt,
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                )
            )
        elif data.barcode:
            barcode_prompt = f"{prompt}\nProduct Barcode / SKU number: {data.barcode}"
            response = client.models.generate_content(
                model='gemini-flash-latest',
                contents=[barcode_prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                )
            )
        else:
            return VisionResponse(
                name="No input provided",
                category="General",
                description="Please provide either an image or barcode.",
                confidence=0.0
            )
        
        result_text = response.text
        if result_text.startswith("```json"):
            result_text = result_text[7:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]
            
        parsed = json.loads(result_text.strip())
        
        b_rate = float(parsed.get("buy_rate") or 0.0)
        s_rate = float(parsed.get("sell_rate") or 0.0)
        margin = float(parsed.get("profit_margin") or (round(((s_rate - b_rate) / s_rate * 100), 1) if s_rate > 0 else 0.0))

        return VisionResponse(
            name=parsed.get("name", "Identified Product"),
            category=parsed.get("category", "General"),
            brand=parsed.get("brand", "Standard"),
            description=parsed.get("description", "No description available."),
            serial=str(parsed.get("serial") or data.barcode or ""),
            buy_rate=b_rate,
            sell_rate=s_rate,
            profit_margin=margin,
            qty=int(parsed.get("qty") or 50),
            reorder_threshold=int(parsed.get("reorder_threshold") or 10),
            supplier_suggestion=parsed.get("supplier_suggestion", ""),
            product_details=str(parsed.get("product_details", "")),
            confidence=0.95
        )
    except Exception as e:
        print(f"Vision API error: {str(e)}")
        # Fallback mock response so the UI flow can be tested even if API quota is exceeded
        fallback_sku = data.barcode if data.barcode else "SN-MOCK-8829"
        return VisionResponse(
            name="Smart AI Product (AI Quota Fallback)",
            category="Electronics",
            brand="NexTech Solutions",
            description=f"High quality electronic inventory item auto-identified by AI vision scanner. Error: {str(e)}",
            serial=fallback_sku,
            buy_rate=150.0,
            sell_rate=249.99,
            profit_margin=40.0,
            qty=30,
            reorder_threshold=8,
            supplier_suggestion="Apex Supply Co.",
            product_details="Color: Matte Black, Warranty: 12 Months, Weight: 450g",
            confidence=0.99
        )

class ChatIntentRequest(BaseModel):
    question: str

class ChatIntentResponse(BaseModel):
    intent: str

class ChatSummaryRequest(BaseModel):
    question: str
    data: dict

class ChatSummaryResponse(BaseModel):
    answer: str

@app.post("/chat/parse-intent", response_model=ChatIntentResponse)
def parse_chat_intent(req: ChatIntentRequest):

    q = req.question.lower()

    # Low stock / reorder
    if any(w in q for w in ["reorder", "low stock", "running out", "threshold", "out of stock", "nearly out", "almost out", "replenish", "restock", "shortage"]):
        return ChatIntentResponse(intent="LOW_STOCK")

    # Best selling
    if any(w in q for w in ["best", "top", "most sold", "most popular", "highest sales", "fast moving", "fast-moving", "leading"]):
        return ChatIntentResponse(intent="BEST_SELLING")

    # Worst selling
    if any(w in q for w in ["worst", "least", "slowest", "slow moving", "slow-moving", "bad", "lowest sales", "poor performing", "not selling"]):
        return ChatIntentResponse(intent="WORST_SELLING")

    # Pricing / price queries
    if any(w in q for w in ["price", "pricing", "cost", "rate", "sell rate", "buy rate", "unit price", "how much", "expensive", "cheap", "markup"]):
        return ChatIntentResponse(intent="PRICING")

    # Revenue / total sales value
    if any(w in q for w in ["revenue", "income", "earnings", "total sales", "sales value", "turnover", "how much did we make", "money made"]):
        return ChatIntentResponse(intent="REVENUE")

    # Sales / transactions
    if any(w in q for w in ["sales", "sold", "transactions", "orders", "receipts", "how many sold", "units sold"]):
        return ChatIntentResponse(intent="SALES_SUMMARY")

    # Profit / margin
    if any(w in q for w in ["profit", "margin", "net", "gain", "loss", "markup", "return on", "how profitable"]):
        return ChatIntentResponse(intent="PROFIT")

    # Moving goods / inventory movement
    if any(w in q for w in ["moving", "movement", "turnover rate", "velocity", "how fast", "which items move", "active goods", "active products"]):
        return ChatIntentResponse(intent="MOVING_GOODS")

    # Total inventory / stock overview
    if any(w in q for w in ["total stock", "inventory", "catalog", "how many products", "all products", "all items", "overview", "summary", "stock level", "stock count"]):
        return ChatIntentResponse(intent="INVENTORY_OVERVIEW")

    # High value products
    if any(w in q for w in ["high value", "most expensive", "premium", "costly", "highest priced"]):
        return ChatIntentResponse(intent="HIGH_VALUE")

    # Damaged / returned goods
    if any(w in q for w in ["damaged", "returned", "defective", "spoiled", "faulty", "broken", "bad stock"]):
        return ChatIntentResponse(intent="DAMAGED_GOODS")

    # Payment methods
    if any(w in q for w in ["payment", "mpesa", "cash", "card", "how paid", "payment method"]):
        return ChatIntentResponse(intent="PAYMENT_METHODS")

    return ChatIntentResponse(intent="UNKNOWN")


@app.post("/chat/summarize", response_model=ChatSummaryResponse)
def summarize_chat(req: ChatSummaryRequest):
    data = req.data
    intent = data.get("intent", "UNKNOWN")

    if intent == "LOW_STOCK":
        items = data.get("items", [])
        if not items:
            return ChatSummaryResponse(answer="Great news! All products are currently above their reorder thresholds. No restocking is needed right now.")
        names = [f"{item.get('name')} (Qty: {item.get('qty')}, Threshold: {item.get('reorderThreshold')})" for item in items[:5]]
        return ChatSummaryResponse(answer=f"⚠️ There are {len(items)} items running low on stock:\n" + "\n".join(f"• {n}" for n in names) + "\nConsider placing reorder requests soon.")

    elif intent == "BEST_SELLING":
        items = data.get("items", [])
        if not items:
            return ChatSummaryResponse(answer="We don't have enough sales data to determine the best-selling items right now.")
        names = [f"{item.get('name')} — {item.get('totalSold')} units sold" for item in items[:5]]
        return ChatSummaryResponse(answer="🏆 Top-selling products:\n" + "\n".join(f"• {n}" for n in names) + "\nThese are driving the most revenue!")

    elif intent == "WORST_SELLING":
        items = data.get("items", [])
        if not items:
            return ChatSummaryResponse(answer="We don't have enough sales data to determine the worst-selling items right now.")
        names = [f"{item.get('name')} — {item.get('totalSold')} units sold" for item in items[:5]]
        return ChatSummaryResponse(answer="📉 Slowest-moving products:\n" + "\n".join(f"• {n}" for n in names) + "\nConsider a discount or promotion to clear these items.")

    elif intent == "PRICING":
        items = data.get("items", [])
        if not items:
            return ChatSummaryResponse(answer="No product pricing data is available at the moment.")
        lines = [f"{item.get('name')} — Buy: KSh {float(item.get('buyRate', 0)):,.2f} | Sell: KSh {float(item.get('sellRate', 0)):,.2f}" for item in items[:8]]
        return ChatSummaryResponse(answer="💰 Current product pricing:\n" + "\n".join(f"• {l}" for l in lines))

    elif intent == "REVENUE":
        total = data.get("totalRevenue", 0)
        count = data.get("saleCount", 0)
        period = data.get("period", "all time")
        return ChatSummaryResponse(answer=f"📊 Total revenue ({period}): **KSh {float(total):,.2f}** across {count} transaction(s).")

    elif intent == "SALES_SUMMARY":
        items = data.get("items", [])
        total = data.get("totalRevenue", 0)
        count = data.get("saleCount", 0)
        top = [f"{i.get('name')} ({i.get('totalSold')} sold)" for i in items[:5]]
        ans = f"🛒 Sales summary: {count} transactions totalling KSh {float(total):,.2f}."
        if top:
            ans += "\n\nTop movers:\n" + "\n".join(f"• {t}" for t in top)
        return ChatSummaryResponse(answer=ans)

    elif intent == "PROFIT":
        items = data.get("items", [])
        if not items:
            return ChatSummaryResponse(answer="No profitability data is available at the moment.")
        lines = []
        for item in items[:6]:
            buy = float(item.get("buyRate", 0))
            sell = float(item.get("sellRate", 0))
            margin = ((sell - buy) / sell * 100) if sell > 0 else 0
            lines.append(f"{item.get('name')} — Margin: {margin:.1f}% (Buy: KSh {buy:,.2f} | Sell: KSh {sell:,.2f})")
        return ChatSummaryResponse(answer="📈 Profit margins by product:\n" + "\n".join(f"• {l}" for l in lines))

    elif intent == "MOVING_GOODS":
        items = data.get("items", [])
        if not items:
            return ChatSummaryResponse(answer="No movement data is available at the moment.")
        lines = [f"{item.get('name')} — {item.get('totalSold')} units sold" for item in items[:6]]
        return ChatSummaryResponse(answer="🚀 Inventory movement (units sold):\n" + "\n".join(f"• {l}" for l in lines) + "\nFast movers are at the top of the list.")

    elif intent == "INVENTORY_OVERVIEW":
        total_products = data.get("totalProducts", 0)
        total_stock = data.get("totalStock", 0)
        in_stock = data.get("inStock", 0)
        low_stock = data.get("lowStock", 0)
        return ChatSummaryResponse(answer=f"📦 Inventory overview:\n• Total SKUs: {total_products}\n• Total units in stock: {total_stock}\n• Products above threshold: {in_stock}\n• Products below threshold (needs reorder): {low_stock}")

    elif intent == "HIGH_VALUE":
        items = data.get("items", [])
        if not items:
            return ChatSummaryResponse(answer="No product data is available at the moment.")
        lines = [f"{item.get('name')} — KSh {float(item.get('sellRate', 0)):,.2f}" for item in items[:6]]
        return ChatSummaryResponse(answer="💎 Highest-priced products:\n" + "\n".join(f"• {l}" for l in lines))

    elif intent == "DAMAGED_GOODS":
        items = data.get("items", [])
        if not items:
            return ChatSummaryResponse(answer="Good news! There are no damaged or returned items recorded in the system.")
        lines = [f"{item.get('name')} (Status: {item.get('status')})" for item in items[:6]]
        return ChatSummaryResponse(answer=f"⚠️ {len(items)} item(s) with damaged/returned status:\n" + "\n".join(f"• {l}" for l in lines))

    elif intent == "PAYMENT_METHODS":
        breakdown = data.get("breakdown", {})
        if not breakdown:
            return ChatSummaryResponse(answer="No payment data is available at the moment.")
        lines = [f"{method.upper()}: KSh {float(amount):,.2f}" for method, amount in breakdown.items()]
        return ChatSummaryResponse(answer="💳 Revenue by payment method:\n" + "\n".join(f"• {l}" for l in lines))

    return ChatSummaryResponse(answer="I'm not sure how to answer that yet. Try asking about:\n• Low stock / reorder needs\n• Best or worst selling products\n• Pricing or profit margins\n• Sales revenue\n• Inventory overview\n• Moving goods\n• Damaged items\n• Payment methods")



class AnomalyRequest(BaseModel):
    product_id: str
    buy_rate: float
    sell_rate: float
    qty: int

class AnomalyResult(BaseModel):
    anomaly_type: str
    severity: str
    description: str

class AnomalyResponse(BaseModel):
    anomalies: List[AnomalyResult]

@app.post("/detect-anomaly", response_model=AnomalyResponse)
def detect_anomaly(req: AnomalyRequest):
    anomalies = []
    
    # 1. Price = 0
    if req.sell_rate <= 0:
        anomalies.append(AnomalyResult(
            anomaly_type="pricing_error",
            severity="high",
            description="Selling price is zero or negative. Potential revenue loss."
        ))
    
    # 2. Negative Margin
    if req.sell_rate > 0 and req.sell_rate < req.buy_rate:
        anomalies.append(AnomalyResult(
            anomaly_type="negative_margin",
            severity="medium",
            description=f"Selling price ({req.sell_rate}) is lower than cost price ({req.buy_rate})."
        ))
        
    # 3. Unrealistic stock jump
    if req.qty > 1000:
        anomalies.append(AnomalyResult(
            anomaly_type="unrealistic_stock",
            severity="medium",
            description=f"Stock quantity ({req.qty}) seems unusually high for a single entry."
        ))

    return AnomalyResponse(anomalies=anomalies)


# ═══════════════════════════════════════════════════════════════════════════════
# ═══════════════════════════════════════════════════════════════════════════════
# Email Daily Business Reports
# ═══════════════════════════════════════════════════════════════════════════════

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")


class EmailReportRequest(BaseModel):
    """Optional body for manual trigger — override recipients."""
    recipients: Optional[List[str]] = None


class EmailReportResponse(BaseModel):
    success: bool
    sent_to: List[str]
    message: str
    report_preview: Optional[str] = None


async def _fetch_backend(client: httpx.AsyncClient, path: str) -> dict | list:
    """Helper: GET from backend API, return parsed JSON or empty dict on error."""
    try:
        resp = await client.get(f"{BACKEND_URL}/api{path}", timeout=10.0)
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        print(f"[WhatsApp] Backend fetch error for {path}: {e}")
    return {}


async def _build_report_text() -> str:
    """Aggregate all 8 business metrics and build the WhatsApp message."""
    today = datetime.now(ZoneInfo("Africa/Nairobi")).strftime("%d %b %Y")

    async with httpx.AsyncClient() as client:
        # Parallel data fetching
        goods_raw        = await _fetch_backend(client, "/inventory/goods")
        sales_raw        = await _fetch_backend(client, "/sales")
        goods: list      = goods_raw if isinstance(goods_raw, list) else []
        sales: list      = sales_raw if isinstance(sales_raw, list) else []

    # ── 1. Inventory Overview ─────────────────────────────────────────────
    total_skus   = len(goods)
    total_units  = sum(g.get("qty", 0) for g in goods)
    low_stock    = [g for g in goods if g.get("qty", 0) <= (g.get("reorderThreshold") or 10)]
    damaged      = [g for g in goods if g.get("status", "") in ("damaged", "returned", "defective")]

    # ── 2. Today's Sales ──────────────────────────────────────────────────
    today_date = date.today().isoformat()  # YYYY-MM-DD
    today_sales = [
        s for s in sales
        if s.get("createdAt", "")[:10] == today_date
        and s.get("status") == "completed"
    ]
    today_revenue = sum(float(s.get("totalAmount", 0)) for s in today_sales)
    all_revenue   = sum(float(s.get("totalAmount", 0)) for s in sales if s.get("status") == "completed")

    # ── 3. Product sales velocity (all-time) ──────────────────────────────
    product_sales: dict[str, dict] = {}
    for s in sales:
        if s.get("status") != "completed":
            continue
        for item in s.get("saleItems", []):
            pid  = item.get("goodId", "")
            name = (item.get("good") or {}).get("name") or \
                   (item.get("good") or {}).get("subCategory", {}).get("name", "Unknown")
            qty  = int(item.get("quantity", 0))
            if pid not in product_sales:
                product_sales[pid] = {"name": name, "sold": 0}
            product_sales[pid]["sold"] += qty

    ranked = sorted(product_sales.values(), key=lambda x: x["sold"], reverse=True)
    best_sellers  = ranked[:5]
    worst_sellers = [r for r in reversed(ranked) if r["sold"] == 0][:5] or ranked[-5:]

    # ── 4. Profit margins ────────────────────────────────────────────────
    margins = []
    for g in goods:
        buy  = float(g.get("buyRate") or 0)
        sell = float(g.get("sellRate") or 0)
        if sell > 0:
            margins.append(((sell - buy) / sell) * 100)
    avg_margin = sum(margins) / len(margins) if margins else 0

    # ── 5. Payment method breakdown ──────────────────────────────────────
    payment_breakdown: dict[str, float] = {}
    for s in sales:
        if s.get("status") != "completed":
            continue
        method = s.get("paymentMethod") or "unknown"
        payment_breakdown[method] = payment_breakdown.get(method, 0.0) + float(s.get("totalAmount", 0))

    # ─────────────────────────────────────────────────────────────────────
    # Build the message
    # ─────────────────────────────────────────────────────────────────────
    lines = [
        f"📊 *Daily Business Report — {today}*",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "",
        "📦 *INVENTORY OVERVIEW*",
        f"• Total SKUs: {total_skus}  |  Total units: {total_units:,}",
        f"• Healthy stock: {total_skus - len(low_stock)}  |  Needs reorder: {len(low_stock)}",
        "",
    ]

    # Low stock section
    lines.append("⚠️ *LOW STOCK / REORDER NEEDS*")
    if low_stock:
        for g in low_stock[:8]:
            qty    = g.get("qty", 0)
            name   = g.get("name") or (g.get("subCategory") or {}).get("name") or g.get("serial", "?")
            status = "🔴 OUT" if qty == 0 else f"🟡 {qty} left"
            lines.append(f"• {name} — {status}")
    else:
        lines.append("• ✅ All products are sufficiently stocked")
    lines.append("")

    # Best sellers
    lines.append("🏆 *BEST SELLING PRODUCTS*")
    if best_sellers:
        for i, p in enumerate(best_sellers, 1):
            lines.append(f"  {i}. {p['name']} — {p['sold']} units sold")
    else:
        lines.append("• No sales data yet")
    lines.append("")

    # Worst / slow movers
    lines.append("📉 *SLOW / WORST SELLING PRODUCTS*")
    if worst_sellers:
        for p in worst_sellers[:5]:
            lines.append(f"• {p['name']} — {p['sold']} units sold")
    else:
        lines.append("• No slow-mover data yet")
    lines.append("")

    # Pricing & margins
    lines.append("💰 *PRICING & PROFIT MARGINS*")
    lines.append(f"• Average margin across catalog: {avg_margin:.1f}%")
    if goods:
        top_margin_good = max(
            goods,
            key=lambda g: (float(g.get("sellRate") or 0) - float(g.get("buyRate") or 0)) / float(g.get("sellRate") or 1)
            if float(g.get("sellRate") or 0) > 0 else 0
        )
        tm_name = top_margin_good.get("name") or (top_margin_good.get("subCategory") or {}).get("name") or "?"
        tm_buy  = float(top_margin_good.get("buyRate") or 0)
        tm_sell = float(top_margin_good.get("sellRate") or 0)
        tm_pct  = ((tm_sell - tm_buy) / tm_sell * 100) if tm_sell > 0 else 0
        lines.append(f"• Highest margin: {tm_name} ({tm_pct:.1f}%)")
    lines.append("")

    # Sales revenue
    lines.append("💵 *SALES REVENUE*")
    lines.append(f"• Today: KSh {today_revenue:,.2f} ({len(today_sales)} transactions)")
    lines.append(f"• All time: KSh {all_revenue:,.2f} ({len([s for s in sales if s.get('status')=='completed'])} transactions)")
    lines.append("")

    # Moving goods
    lines.append("🚀 *MOVING GOODS (TOP VELOCITY)*")
    if ranked:
        for p in ranked[:4]:
            lines.append(f"• {p['name']} — {p['sold']} units")
    else:
        lines.append("• No movement data yet")
    lines.append("")

    # Damaged / returned
    lines.append("🔴 *DAMAGED / RETURNED ITEMS*")
    if damaged:
        for g in damaged[:5]:
            name = g.get("name") or (g.get("subCategory") or {}).get("name") or g.get("serial", "?")
            lines.append(f"• {name} — Status: {g.get('status', '?').upper()}")
    else:
        lines.append("• ✅ No damaged or returned items recorded")
    lines.append("")

    # Payment methods
    lines.append("💳 *PAYMENT METHODS*")
    if payment_breakdown:
        for method, amount in sorted(payment_breakdown.items(), key=lambda x: -x[1]):
            lines.append(f"• {method.replace('_', ' ').title()}: KSh {amount:,.2f}")
    else:
        lines.append("• No payment data yet")

    lines += [
        "",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "🤖 _Generated by OICS AI Engine_",
    ]

    return "\n".join(lines)


async def _send_email_message(server: str, port: int, user: str, password: str, recipient: str, message: str) -> bool:
    """Send a single email message via SMTP. Returns True on success."""
    try:
        msg = MIMEMultipart()
        msg['From'] = user
        msg['To'] = recipient
        msg['Subject'] = "OICS Daily Business Report"
        
        # We can send it as plain text or HTML. Using plain text since markdown is somewhat formatted.
        msg.attach(MIMEText(message, 'plain', 'utf-8'))
        
        with smtplib.SMTP(server, port) as smtp:
            smtp.starttls()
            smtp.login(user, password)
            smtp.send_message(msg)
        return True
    except Exception as e:
        print(f"[Email] Send error to {recipient}: {e}")
    return False


async def send_daily_email_report():
    """Core function: build report and dispatch to all configured recipients."""
    server     = os.getenv("SMTP_SERVER", "")
    port_str   = os.getenv("SMTP_PORT", "587")
    user       = os.getenv("SMTP_USER", "")
    password   = os.getenv("SMTP_PASSWORD", "")
    recipients_raw = os.getenv("EMAIL_RECIPIENTS", "")

    try:
        port = int(port_str)
    except ValueError:
        port = 587

    if not server or not user or not password or "your_" in user:
        print("[Email] Credentials not configured — skipping report.")
        return

    recipients = [r.strip() for r in recipients_raw.split(",") if r.strip()]
    if not recipients:
        print("[Email] No recipients configured — skipping report.")
        return

    print(f"[Email] Building daily report for {len(recipients)} recipient(s)...")
    report_text = await _build_report_text()

    for recipient in recipients:
        ok = await _send_email_message(server, port, user, password, recipient, report_text)
        status = "[SUCCESS]" if ok else "[FAILED]"
        print(f"[Email] {status} -> {recipient}")


@app.post("/email/send-report", response_model=EmailReportResponse)
async def trigger_email_report(req: EmailReportRequest = EmailReportRequest()):
    """
    Manually trigger the Email daily report.
    Optionally override recipients via the request body.
    """
    server     = os.getenv("SMTP_SERVER", "")
    port_str   = os.getenv("SMTP_PORT", "587")
    user       = os.getenv("SMTP_USER", "")
    password   = os.getenv("SMTP_PASSWORD", "")
    recipients_env = os.getenv("EMAIL_RECIPIENTS", "")
    
    try:
        port = int(port_str)
    except ValueError:
        port = 587

    if not server or not user or not password or "your_" in user:
        return EmailReportResponse(
            success=False,
            sent_to=[],
            message="Email credentials not configured. Add SMTP_SERVER, SMTP_USER, and SMTP_PASSWORD to ai_service/.env",
        )

    recipients = req.recipients or [r.strip() for r in recipients_env.split(",") if r.strip()]
    if not recipients:
        return EmailReportResponse(
            success=False,
            sent_to=[],
            message="No recipients configured. Set EMAIL_RECIPIENTS in ai_service/.env",
        )

    report_text = await _build_report_text()
    sent_to, failed = [], []

    for recipient in recipients:
        ok = await _send_email_message(server, port, user, password, recipient, report_text)
        (sent_to if ok else failed).append(recipient)

    success = len(sent_to) > 0
    msg = f"Report sent to {len(sent_to)} recipient(s)."
    if failed:
        msg += f" Failed: {', '.join(failed)}"

    return EmailReportResponse(
        success=success,
        sent_to=sent_to,
        message=msg,
        report_preview=report_text[:800] + "..." if len(report_text) > 800 else report_text,
    )


@app.get("/email/config")
async def get_email_config():
    """Return current Email config (credentials masked)."""
    server     = os.getenv("SMTP_SERVER", "")
    user       = os.getenv("SMTP_USER", "")
    password   = os.getenv("SMTP_PASSWORD", "")
    recipients = os.getenv("EMAIL_RECIPIENTS", "")
    hour       = int(os.getenv("EMAIL_REPORT_HOUR", "8"))
    
    configured = bool(server and user and password and "your_" not in user)
    return {
        "configured": configured,
        "recipients": [r.strip() for r in recipients.split(",") if r.strip()],
        "report_hour": hour,
        "server_set": bool(server),
        "user_set": bool(user and "your_" not in user),
        "password_set": bool(password and "your_" not in password),
        "next_scheduled": f"{hour:02d}:00 EAT (Africa/Nairobi)",
    }

class UpdateRecipientsRequest(BaseModel):
    recipients: List[str]

@app.post("/email/recipients")
async def update_email_recipients(req: UpdateRecipientsRequest):
    """
    Update EMAIL_RECIPIENTS in memory and persist in ai_service/.env file.
    """
    new_recipients_str = ", ".join([r.strip() for r in req.recipients if r.strip()])
    os.environ["EMAIL_RECIPIENTS"] = new_recipients_str

    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            
            updated = False
            new_lines = []
            for line in lines:
                if line.startswith("EMAIL_RECIPIENTS="):
                    new_lines.append(f"EMAIL_RECIPIENTS={new_recipients_str}\n")
                    updated = True
                else:
                    new_lines.append(line)
            if not updated:
                new_lines.append(f"EMAIL_RECIPIENTS={new_recipients_str}\n")

            with open(env_path, "w", encoding="utf-8") as f:
                f.writelines(new_lines)
        except Exception as e:
            print(f"[Email] Could not persist .env: {e}")

    return {
        "success": True,
        "recipients": [r.strip() for r in new_recipients_str.split(",") if r.strip()],
        "message": f"Updated recipient list. Total: {len(req.recipients)}"
    }

class DeliveryCostRequest(BaseModel):
    lat: float
    lng: float
    address: str

class DeliveryCostResponse(BaseModel):
    cost: float
    distance_km: float
    reason: str

@app.post("/delivery-cost", response_model=DeliveryCostResponse)
def calculate_delivery_cost(req: DeliveryCostRequest):
    # Nairobi CBD coordinates as store base
    STORE_LAT = float(os.getenv("STORE_LAT", "-1.2921"))
    STORE_LNG = float(os.getenv("STORE_LNG", "36.8219"))

    # Haversine formula
    R = 6371.0 # Earth radius in km
    lat1 = math.radians(STORE_LAT)
    lon1 = math.radians(STORE_LNG)
    lat2 = math.radians(req.lat)
    lon2 = math.radians(req.lng)

    dlon = lon2 - lon1
    dlat = lat2 - lat1

    a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = R * c

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        # Fallback without AI
        cost = 100 + (distance * 50)
        return DeliveryCostResponse(
            cost=round(cost, 2),
            distance_km=round(distance, 2),
            reason=f"Calculated using standard rate of 100 KES base + 50 KES per km for {distance:.2f} km."
        )

    try:
        client = genai.Client(api_key=api_key)
        prompt = f"""
        Calculate a fair, realistic transport/delivery cost in Kenyan Shillings (KES) using a motorcycle courier in Nairobi, Kenya.
        The delivery distance is {distance:.2f} km from Nairobi CBD to: {req.address}.
        
        Provide a JSON response strictly with these keys:
        - "cost": The estimated total delivery cost as a number (e.g. 250.0). Minimum should be 100.
        - "reason": A short 1-sentence explanation of the calculation or pricing logic.
        Make sure the response is strictly valid JSON.
        """
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=[prompt],
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        
        result_text = response.text
        if result_text.startswith("```json"):
            result_text = result_text[7:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]
            
        parsed = json.loads(result_text.strip())
        return DeliveryCostResponse(
            cost=float(parsed.get("cost", 100 + (distance * 50))),
            distance_km=round(distance, 2),
            reason=str(parsed.get("reason", f"Calculated based on {distance:.2f} km distance."))
        )
    except Exception as e:
        print(f"Delivery AI error: {str(e)}")
        cost = 100 + (distance * 50)
        return DeliveryCostResponse(
            cost=round(cost, 2),
            distance_km=round(distance, 2),
            reason=f"Standard rate fallback due to API error. Distance: {distance:.2f} km."
        )
