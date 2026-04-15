# import các thư viện

import numpy as np       # thư viện xử lý số học, ma trận
import pandas as pd      # thư viện xử lí dữ liệu CSV, EXCel   
import matplotlib.pyplot as plt      # vẽ biểu đồ cơ bản
import seaborn as sns      # vẽ biểu đồ đẹp, trực quan hơn matplotlib

from sklearn.datasets import fetch_openml   # lấy dataset từ OPENML (vd: MINST)
from sklearn.model_selection import train_test_split    # chia dữ liệu train và test
from sklearn.metrics import (
    accuracy_score,         # ĐỘ chính xác
    classification_report, #báo cáo pression, recall, f1-score
    roc_auc_score, # chỉ số ROC AUC
    roc_curve,    #vẽ đường cong ROC
    precision_recall_curve       # vẽ đường cong pression - recall
)

# ĐỌC VÀ TIỀN XỬ LÝ

mnist = fetch_openml(
    'mnist_784',
    version=1,
    as_frame=False
) # Láy dữ liệu chữ số viết tay. nếu TRue = dataFrame or False = numpy

# TÁCH DỮ LIỆU HUẤN LUYỆN
X, y = mnist.data, mnist.target.astype(np.uint8)   #chuyển nhãn label về kiểu số nguyên từ 0 tới 9

print('HUẤN LUYỆN XONG')

#      TEST HIỆN THỊ 5 BỨC ẢNH XEM CHUẨN KHÔNG
fig, axes = plt.subplots(1, 5, figsize = (10, 5))     # tạo khung gồm 1 hàng và 5 cột
for i, ax in enumerate(axes):
    ax.imshow(
        X[i].reshape(28, 28),
        cmap = 'gray'
    ) # Reshape vector 784 pixel thành 28 * 28 (đen trắng)
    ax.set_title(f'label: {y[i]}')
    ax.axis('off')   #tắt trục xy để gọn hơn

plt.show()


# KIỂM TRA PHÂN BỐ NHÃN

from collections import Counter    #dùng để đếm

#đếm tần suất xuất hiện của từng nhãn dãn (0-9)
counter = Counter(y)          #đếm số lần xuất hiện của mỗi chữ.
counter = counter.most_common()    # Trả về list các cặp (số, count) sắp xếp theo tần suất
counter = pd.DataFrame(counter)
counter.columns = ['số', 'số lượng'] # Đặt tên cột


#   CHIA TẬP HUẤN LUYỆN

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size = 0.2,     # lấy 20% dữ liệu để test
    stratify= y,     # giữ tỉ lệ các lớp (0 - 9)đồng đều ở cả train & test
    random_state= 42        # đặt seed để chạy lại vẫn ra kết quả giông nhau
)

print('Kích thước bộ dữ liệu Train/Test:')
print(f'Tập Train: {X_train.shape} và Tập Test: {X_test.shape}')

# HUẤN LUYỆN MÔ HÌNH

from sklearn.neighbors import KNeighborsClassifier

# khởi tạo mô hình KNN
model = KNeighborsClassifier(
    n_neighbors= 10,        # số hàng xóm gần nhất để vote (k = 10)
    metric= 'euclidean',     # Dùng khoảng cách eculid để tính độ gần
    weights='distance'      # Hàng xóm gần hơn thì có trọng số cao hơn
)

#huấn luyện mô hình với dữ liệu Train
model.fit(X_train, y_train)

# DỰ ĐOÁN VÀ ĐÁNH GIÁ
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import cv2


# ==== Hàm dự đoán và đánh giá mô hình====
def pre_and_eva(model, X_test, y_test):
    print('BẮT ĐẦU DỰ ĐOÁN')

    file_name = input('nhập file cần dự đoán của bạn: ')

    # đọc ảnh dạng đen trắng
    img = cv2.imread(file_name, cv2.IMREAD_GRAYSCALE)
    if img is None:
        print(f'Lỗi không tìm thấy file {img}')
        return
    
    # Thu nhỏ ảnh về 28 * 28 pixel
    img_late = cv2.resize(img, (28, 28), interpolation=cv2.INTER_AREA)


    # Ép kiểu làm phẳng vector
    img_final = img_late.reshape(1, 784)


    # result machine
    result = model.predict(img_final)

    #hiển thị kq trực quan - vẽ số
    plt.figure(figsize=(6, 6))
    plt.imshow(img_late, cmap='gray')
    plt.title(f"DỰ ĐOÁN: SỐ {result[0]}", fontsize=20, color='red')
    plt.axis('off')
    plt.show()
    print(f"Kết quả: Máy nhận diện đây là số {result[0]}")
    
    y_pred = model.predict(X_test)     #mô hình dự đoán trên tập test

    # Đánh giá độ chính xác
    acc = accuracy_score(y_test, y_pred)
    #ma trận nhầm lẫn cho biết mô hình hay nhầm với số nào
    cfs = confusion_matrix(y_test, y_pred)

    # Báo cáo chi tiết: precision, recall, f1 - score
    clr = classification_report(y_test, y_pred)

    print(f'độ chính xác là: {acc}')
    print(cfs)
    print('-'*100)

    print('Classifision_report: ')
    print(clr)

pre_and_eva(model, X_test, y_test)
