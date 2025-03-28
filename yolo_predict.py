from ultralytics import YOLO

def predict(filepath):
    print("Predicting on image:", filepath)
    # Load a model
    model = YOLO("yolo_models/yolo11x.pt")  # pretrained YOLO11n model

    # Run batched inference on a list of images
    results = model([filepath])  # return a list of Results objects
    return results
    # Process results list

if __name__ == "__main__":
    # Example usage
    results = predict("images/highway_sign1.png")
    for result in results:
        boxes = result.boxes  # Boxes object for bounding box outputs
        masks = result.masks  # Masks object for segmentation masks outputs
        keypoints = result.keypoints  # Keypoints object for pose outputs
        probs = result.probs  # Probs object for classification outputs
        obb = result.obb  # Oriented boxes object for OBB outputs
        # result.show()  # display to screen
        result.save(filename="result.png", conf=True, labels=True, boxes=True)  # save to disk with boxes, labels and confidence
                