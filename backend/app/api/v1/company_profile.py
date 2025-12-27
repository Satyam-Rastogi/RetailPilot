from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.company_profile import CompanyProfileModel
from app.schemas.company_profile import CompanyProfile, CompanyProfileCreate, CompanyProfileUpdate

router = APIRouter()


@router.get("/", response_model=CompanyProfile)
def get_company_profile(db: Session = Depends(get_db)):
  profile = db.query(CompanyProfileModel).first()
  if not profile:
    raise HTTPException(status_code=404, detail="Company profile not found")
  return profile


@router.post("/", response_model=CompanyProfile)
def create_company_profile(profile: CompanyProfileCreate, db: Session = Depends(get_db)):
  existing = db.query(CompanyProfileModel).first()
  if existing:
    raise HTTPException(status_code=400, detail="Company profile already exists")
  db_profile = CompanyProfileModel(**profile.model_dump())
  db.add(db_profile)
  db.commit()
  db.refresh(db_profile)
  return db_profile


@router.put("/", response_model=CompanyProfile)
def update_company_profile(profile: CompanyProfileUpdate, db: Session = Depends(get_db)):
  db_profile = db.query(CompanyProfileModel).first()
  if not db_profile:
    raise HTTPException(status_code=404, detail="Company profile not found")
  
  for key, value in profile.model_dump(exclude_unset=True).items():
    setattr(db_profile, key, value)
  
  db.commit()
  db.refresh(db_profile)
  return db_profile
