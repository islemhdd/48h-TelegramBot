import cv2
import pytesseract
from pytesseract import Output
from pathlib import Path
import re
import numpy as np
from predict_classifier import predict

def find_group_band(image_path: str | Path, target_group: str):
    """
    Cherche 'Groupe X' dans l'image, retourne:
      - cropped_row: image de la bande du groupe (ou None)
      - info: dict avec image_path, found (bool), y_center, row_index
    """
    result,confidence=predict(image_path)
    if result=="program" and confidence>0.7:
        target_group = target_group.upper()
        img = cv2.imread((image_path))
        
        if img is None:
            raise FileNotFoundError(image_path)

        h, w, _ = img.shape

        data = pytesseract.image_to_data(img, lang="fra+eng", output_type=Output.DICT)
        print(data)
    else:
        print("not a program")




find_group_band("dataset/test/program/5766977434904806573.jpg")
