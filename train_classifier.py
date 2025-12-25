"""
Training script for the binary program classifier used in the PlanningProgrammer
project. It expects an ImageFolder dataset laid out as:

dataset/
    train/
        class_a/
        class_b/
    val/
        class_a/
        class_b/

The script applies light augmentation to the training set, balances classes with
WeightedRandomSampler and a weighted cross-entropy loss, fine-tunes a
ResNet18 (ImageNet weights), and saves the resulting checkpoint to
`program_classifier.pt`. Adjust the constants below to tweak batch size,
epochs, learning rate, or dataset locations.
"""

import torch, torchvision
from torchvision import transforms
from torch import nn
from torch.utils.data import DataLoader, WeightedRandomSampler
from torchvision.datasets import ImageFolder
from tqdm import tqdm
import numpy as np
from pathlib import Path

BASE = Path(__file__).resolve().parent
TRAIN_DIR = BASE / "dataset" / "train"
VAL_DIR   = BASE / "dataset" / "val"
MODEL_OUT = BASE / "program_classifier.pt"

BATCH = 16
EPOCHS = 8
LR = 1e-4
device = "cuda" if torch.cuda.is_available() else "cpu"

train_tf = transforms.Compose([
    transforms.Resize((224,224)),                    # uniform input size
    transforms.RandomRotation(5),                    # small rotation jitter
    transforms.RandomResizedCrop(224, scale=(0.9, 1.0)),  # slight zoom/crop
    transforms.ColorJitter(brightness=0.2, contrast=0.2), # light color jitter
    transforms.ToTensor(),
    transforms.Normalize([0.485,0.456,0.406],[0.229,0.224,0.225])  # ImageNet stats
])

val_tf = transforms.Compose([
    transforms.Resize((224,224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485,0.456,0.406],[0.229,0.224,0.225])
])

train_ds = ImageFolder(TRAIN_DIR, transform=train_tf)
val_ds   = ImageFolder(VAL_DIR  , transform=val_tf)

print("Classes:", train_ds.classes)

# --- Oversampling pour compenser le déséquilibre ---
labels = [y for _, y in train_ds.samples]
class_counts = np.bincount(labels)
# Compute class weights inversely proportional to the number of samples per class.
# This helps to balance the impact of each class during training, especially in the presence of class imbalance.
class_weights = 1.0 / class_counts
sample_weights = [class_weights[y] for y in labels]

sampler = WeightedRandomSampler(
    sample_weights,              # weight per sample -> more draws for rare class
    num_samples=len(labels) * 2, # draw twice the dataset size per epoch
    replacement=True             # allow repeats; otherwise sampler cannot oversample
)

train_dl = DataLoader(train_ds, batch_size=BATCH, sampler=sampler)
val_dl   = DataLoader(val_ds, batch_size=BATCH, shuffle=False)

# --- Modèle ---
model = torchvision.models.resnet18(weights="DEFAULT")
model.fc = nn.Linear(model.fc.in_features, 2)  # swap final layer for binary task
model = model.to(device)

# --- Loss pondérée ---
cw = torch.tensor(class_counts.sum() / class_counts, dtype=torch.float32).to(device)
loss_fn = nn.CrossEntropyLoss(weight=cw)  # per-class weighting matches sampler

opt = torch.optim.Adam(model.parameters(), lr=LR)

def eval_loader(dl):
    """Run a full pass on a dataloader and return accuracy plus raw preds/labels."""
    model.eval()
    correct, total = 0, 0
    all_preds, all_y = [], []
    with torch.no_grad():
        for x, y in dl:
            x, y = x.to(device), y.to(device)
            logits = model(x)
            pred = logits.argmax(1)
            correct += (pred == y).sum().item()
            total += x.size(0)
            all_preds.extend(pred.cpu().tolist())
            all_y.extend(y.cpu().tolist())
    return correct/total, all_preds, all_y

for epoch in range(EPOCHS):
    model.train()
    total_loss = 0

    for x, y in tqdm(train_dl, desc=f"epoch {epoch+1}/{EPOCHS}"):
        x, y = x.to(device), y.to(device)
        opt.zero_grad()
        logits = model(x)
        loss = loss_fn(logits, y)
        loss.backward()
        opt.step()
        total_loss += loss.item() * x.size(0)

    train_acc, _, _ = eval_loader(train_dl)
    val_acc, _, _ = eval_loader(val_dl)

    print(f"loss={total_loss/len(train_ds):.4f} "
          f"train_acc={train_acc:.3f} val_acc={val_acc:.3f}")

torch.save({"model": model.state_dict(), "classes": train_ds.classes}, MODEL_OUT)
print("✅ saved to", MODEL_OUT)
