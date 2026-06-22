from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
import random

app = FastAPI(title="OICS AI Decision Engine 🧠")

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

