from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
import pandas as pd
import random

app = FastAPI(title="StockIQ AI Service")

class SalesData(BaseModel):
    product_id: str
    historical_sales: List[int]

class PredictionResponse(BaseModel):
    product_id: str
    predicted_sales_next_week: int
    confidence_score: float

@app.get("/")
def read_root():
    return {"message": "AI Forecasting Service is running 🧠"}

@app.post("/predict", response_model=PredictionResponse)
def predict_demand(data: SalesData):
    # Dummy implementation for demand forecasting
    # In a real scenario, you would load a trained scikit-learn/XGBoost model here
    # and run inference on the `data.historical_sales`.
    
    # For now, we simulate a prediction using a moving average + random noise
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
        predicted_sales_next_week=predicted,
        confidence_score=round(random.uniform(0.7, 0.95), 2)
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
