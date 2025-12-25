import torch
import torchvision
from torch import nn
from torchvision import transforms
from PIL import Image
from pathlib import Path

BASE = Path(__file__).resolve().parent
MODEL_PATH = BASE / "program_classifier.pt"

device = "cuda" if torch.cuda.is_available() else "cpu"

# Charger le modèle
ckpt = torch.load(MODEL_PATH, map_location=device)
classes = ckpt["classes"]

model = torchvision.models.resnet18(weights=None)
model.fc = nn.Linear(model.fc.in_features, len(classes))
model.load_state_dict(ckpt["model"])
model.eval().to(device)

# Transformations identiques au training
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485,0.456,0.406],[0.229,0.224,0.225])
])

def predict(img_path):
    img = Image.open(img_path).convert("RGB")
    x = transform(img).unsqueeze(0).to(device)

    with torch.no_grad():
        logits = model(x)
        probs = torch.softmax(logits, dim=1)[0]

    idx = int(probs.argmax().item())
    label = classes[idx]
    confidence = float(probs[idx].item())
    return label, confidence

__all__ = ["predict"]
if __name__ == "__main__":
    import sys
    files = [
    "5766977434904806573.jpg",
    "5791653254679694355.jpg",
    "5830390015693884381.jpg",
    "5830390015693884384.jpg",
    "5864231411638799393.jpg",
    "5868587586509982284.jpg",
    "5868587586509982287.jpg",
    "6014827967353570547 (1).jpg",
    "6019273404533821928.jpg",
    "6030462807952180450 (1).jpg",
]

    if len(sys.argv) < 2:
        for img in files:
            img= "dataset/test/program/" + img

            result=predict(img)
            print(result)
            exit()

    img_path = sys.argv[1]
    label, conf = predict(img_path)
    print({"label": label, "confidence": conf})











