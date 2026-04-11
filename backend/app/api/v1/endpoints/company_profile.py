from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models.company_profile import CompanyProfileModel
from app.schemas.company_profile import CompanyProfile, CompanyProfileCreate, CompanyProfileUpdate

router = APIRouter()


@router.get(
    "/",
    response_model=CompanyProfile,
    summary="Get company profile",
    description="Returns the single company/shop profile record. Used to populate the print header on invoices and receipts.",
    responses={404: {"description": "Profile not yet created — use POST to create it"}},
)
def get_company_profile(db: Session = Depends(get_db)):
  profile = db.query(CompanyProfileModel).first()
  if not profile:
    raise HTTPException(status_code=404, detail="Company profile not found")
  return profile


@router.post(
    "/",
    response_model=CompanyProfile,
    status_code=201,
    summary="Create company profile",
    description="Creates the company profile. Only one record is allowed — returns 400 if a profile already exists. Use PUT to update it.",
    responses={400: {"description": "Company profile already exists — use PUT to update"}},
)
def create_company_profile(profile: CompanyProfileCreate, db: Session = Depends(get_db)):
  existing = db.query(CompanyProfileModel).first()
  if existing:
    raise HTTPException(status_code=400, detail="Company profile already exists")
  db_profile = CompanyProfileModel(**profile.model_dump())
  db.add(db_profile)
  db.commit()
  db.refresh(db_profile)
  return db_profile


@router.put(
    "/",
    response_model=CompanyProfile,
    summary="Update company profile",
    responses={404: {"description": "Profile not found — use POST to create it first"}},
)
def update_company_profile(profile: CompanyProfileUpdate, db: Session = Depends(get_db)):
  db_profile = db.query(CompanyProfileModel).first()
  if not db_profile:
    raise HTTPException(status_code=404, detail="Company profile not found")
  
  for key, value in profile.model_dump(exclude_unset=True).items():
    setattr(db_profile, key, value)
  
  db.commit()
  db.refresh(db_profile)
  return db_profile
