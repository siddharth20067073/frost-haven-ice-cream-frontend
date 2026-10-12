"use strict";

let allProducts = [];
let activeCategory = "All Ice Creams";
let activeSort = "default";

const CART_KEY = "frostHavenCart";
const USER_KEY = "frostHavenUser";

// Customer-page login protection.
(function protectCustomerPages() {
    const path = window.location.pathname;
    const publicPages = [
        "/pages/login.html",
        "/pages/register.html"
    ];

    function hasCustomerSession() {
        try {
            const user = JSON.parse(
                localStorage.getItem(USER_KEY) || "null"
            );

            return Boolean(
                user &&
                typeof user === "object" &&
                (user.id || user.userId || user.email)
            );
        } catch (error) {
            return false;
        }
    }

    // Do not apply customer login checks to admin pages.
    if (path.startsWith("/admin/")) {
        return;
    }

    // Allow login and registration pages without a session.
    if (publicPages.includes(path)) {
        if (hasCustomerSession()) {
            window.location.replace("/");
        }
        return;
    }

    // Redirect unauthenticated customers to login.
    if (!hasCustomerSession()) {
        sessionStorage.setItem(
            "frostHavenReturnTo",
            path + window.location.search + window.location.hash
        );

        window.location.replace("/pages/login.html");
    }

    // Check if the user logs out in another browser tab.
    window.addEventListener("storage", function (event) {
        if (
            event.key === USER_KEY &&
            !hasCustomerSession()
        ) {
            window.location.replace("/pages/login.html");
        }
    });
})();

// Utility functions
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function getProductImage(image) {
    if (!image || !String(image).trim()) {
        return "/images/image-not-found.jpg";
    }

    const value = String(image).trim();

    if (/^https?:\/\//i.test(value)) {
        return value;
    }

    return "/images/" + value.replace(/^\/+/, "");
}

// Cart storage
function getCart() {
    try {
        const cart = JSON.parse(
            localStorage.getItem(CART_KEY) || "[]"
        );

        return Array.isArray(cart) ? cart : [];
    } catch (error) {
        console.error("Could not read cart:", error);
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartCount();
    renderCart();
}

function updateCartCount() {
    const cart = getCart();

    const count = cart.reduce((total, item) => {
        return total + Math.max(
            0,
            Number(item.quantity) || 0
        );
    }, 0);

    document.querySelectorAll(
        ".cart-count, #cart-count, [data-cart-count]"
    ).forEach(element => {
        element.textContent = count;
    });
}
// Load products from Spring Boot
async function loadProducts() {
    try {
        const response = await fetch("/api/products");

        if (!response.ok) {
            throw new Error("Could not load products.");
        }

        const products = await response.json();

        if (!Array.isArray(products)) {
            throw new Error("Invalid product response.");
        }

        allProducts = products;

        renderProducts(getFilteredAndSortedProducts());
        loadProductDetails();

    } catch (error) {
        console.error("Product loading error:", error);

        const list = document.getElementById("product-list");

        if (list) {
            list.textContent =
                "Unable to load products. Please refresh and try again.";
        }

        const details = document.getElementById("product-details");

        if (details) {
            details.textContent =
                "Unable to load product details. Please try again.";
        }

        updateProductCount(0);
    }
}

// Category filtering and sorting
function matchesCategory(product, category) {
    const productCategory = String(product.category || "")
        .trim()
        .toLowerCase();

    if (category === "All Ice Creams") {
        return true;
    }

    if (category === "Fruity Delights") {
        return [
            "strawberry",
            "mango",
            "black currant"
        ].includes(productCategory);
    }

    if (category === "Chocolate Heaven") {
        return productCategory === "chocolate";
    }

    if (category === "Premium Specials") {
        return productCategory === "premium";
    }

    return false;
}

function getFilteredAndSortedProducts() {
    let products = allProducts.filter(product =>
        matchesCategory(product, activeCategory)
    );

    if (activeSort === "price-low") {
        products.sort(
            (a, b) => Number(a.price) - Number(b.price)
        );
    } else if (activeSort === "price-high") {
        products.sort(
            (a, b) => Number(b.price) - Number(a.price)
        );
    } else if (activeSort === "name") {
        products.sort((a, b) =>
            String(a.productName || "").localeCompare(
                String(b.productName || "")
            )
        );
    }

    return products;
}

function filterProducts(category) {
    activeCategory = category;
    renderProducts(getFilteredAndSortedProducts());
}

function sortProducts(sortValue) {
    activeSort = sortValue;
    renderProducts(getFilteredAndSortedProducts());
}

// Render product cards
function renderProducts(products) {
    const list = document.getElementById("product-list");

    if (!list) {
        return;
    }

    if (!products.length) {
        list.innerHTML = "<p>No products found.</p>";
        updateProductCount(0);
        return;
    }

    list.innerHTML = products.map(product => `
        <article class="product-card">
            <img
                src="${escapeHTML(getProductImage(product.image))}"
                alt="${escapeHTML(product.productName)}"
                class="product-card-image"
                onerror="this.onerror=null; this.alt='Image unavailable';"
            >

            <div class="product-card-content">
                <p class="product-category">
                    ${escapeHTML(product.category || "")}
                </p>

                <h3>${escapeHTML(product.productName)}</h3>

                <p>
                    ${escapeHTML(product.description || "")}
                </p>

                <p class="product-price">
                    ₹${Number(product.price || 0).toFixed(2)}
                </p>

                <p>Stock: ${Number(product.stock) || 0}</p>

                <div class="product-card-actions">
                    <button
                        type="button"
                        class="btn-view"
                        onclick="viewProduct(${Number(product.id)})">
                        ↗ View
                    </button>

                    <button
                        type="button"
                        class="btn-cart"
                        onclick="addToCart(${Number(product.id)})"
                        ${Number(product.stock) <= 0 ? "disabled" : ""}>
                        🛒 Add to Cart
                    </button>
                </div>
            </div>
        </article>
    `).join("");

    updateProductCount(products.length);
}

function updateProductCount(count) {
    const element = document.getElementById("product-count");

    if (element) {
        element.textContent = `${count} Ice Creams`;
    }
}

// Product details
function viewProduct(id) {
    window.location.href =
        `/pages/product-details.html?id=${encodeURIComponent(id)}`;
}

async function loadProductDetails() {
    const container = document.getElementById("product-details");

    if (!container) {
        return;
    }

    const id = new URLSearchParams(window.location.search).get("id");

    if (!id) {
        container.textContent = "Product not found.";
        return;
    }

    try {
        let product = allProducts.find(
            item => Number(item.id) === Number(id)
        );

        if (!product) {
            const response = await fetch(
                `/api/products/${encodeURIComponent(id)}`
            );

            if (!response.ok) {
                throw new Error("Product not found.");
            }

            product = await response.json();
        }

        container.innerHTML = `
            <div class="product-details-card">
                <img
                    src="${escapeHTML(getProductImage(product.image))}"
                    alt="${escapeHTML(product.productName)}"
                    class="product-details-image"
                    onerror="this.onerror=null; this.alt='Image unavailable';"
                >

                <div class="product-details-info">
                    <p>${escapeHTML(product.category || "")}</p>

                    <h1>${escapeHTML(product.productName)}</h1>

                    <p>${escapeHTML(product.description || "")}</p>

                    <h2>
                        ₹${Number(product.price || 0).toFixed(2)}
                    </h2>

                    <p>
                        Available stock: ${Number(product.stock) || 0}
                    </p>

                    <button
                        type="button"
                        class="btn-cart"
                        onclick="addToCart(${Number(product.id)})"
                        ${Number(product.stock) <= 0 ? "disabled" : ""}>
                        🛒 Add to Cart
                    </button>
                </div>
            </div>
        `;
    } catch (error) {
        console.error("Product details error:", error);
        container.textContent = "Unable to load product details.";
    }
}
// Add products to cart
function addToCart(productId, quantity = 1) {
    const product = allProducts.find(
        item => Number(item.id) === Number(productId)
    );

    if (!product) {
        alert("Please wait for products to load and try again.");
        return;
    }

    const stock = Number(product.stock) || 0;
    quantity = Number(quantity);

    if (!Number.isInteger(quantity) || quantity <= 0) {
        alert("Please select a valid quantity.");
        return;
    }

    if (stock <= 0) {
        alert("This product is out of stock.");
        return;
    }

    const cart = getCart();

    const existing = cart.find(
        item => Number(item.id) === Number(product.id)
    );

    const currentQuantity = existing
        ? Number(existing.quantity) || 0
        : 0;

    if (currentQuantity + quantity > stock) {
        alert("Sorry, not enough stock available.");
        return;
    }

    if (existing) {
        existing.quantity = currentQuantity + quantity;
    } else {
        cart.push({
            id: product.id,
            productName: product.productName,
            price: Number(product.price),
            image: product.image,
            quantity: quantity
        });
    }

    saveCart(cart);
    alert(`${product.productName} added to cart!`);
}

// Render cart
function renderCart() {
    const cartList = document.getElementById("cart-items");
    const cartTotal = document.getElementById("cart-total");

    if (!cartList) {
        return;
    }

    const cart = getCart();

    if (!cart.length) {
        cartList.innerHTML = "<p>Your cart is empty.</p>";

        if (cartTotal) {
            cartTotal.textContent = "₹0.00";
        }

        return;
    }

    let total = 0;

    cartList.innerHTML = cart.map(item => {
        const price = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 0;
        const subtotal = price * quantity;

        total += subtotal;

        return `
            <div class="cart-item">
                <img
                    src="${escapeHTML(getProductImage(item.image))}"
                    alt="${escapeHTML(item.productName)}"
                    onerror="this.onerror=null; this.alt='Image unavailable';"
                >

                <div class="cart-item-details">
                    <h3>${escapeHTML(item.productName)}</h3>

                    <p>₹${price.toFixed(2)}</p>

                    <div class="cart-quantity">
                        <button
                            type="button"
                            onclick="updateCartQuantity(${Number(item.id)}, -1)">
                            −
                        </button>

                        <span>${quantity}</span>

                        <button
                            type="button"
                            onclick="updateCartQuantity(${Number(item.id)}, 1)">
                            +
                        </button>
                    </div>

                    <p>Subtotal: ₹${subtotal.toFixed(2)}</p>

                    <button
                        type="button"
                        onclick="removeFromCart(${Number(item.id)})">
                        Remove
                    </button>
                </div>
            </div>
        `;
    }).join("");

    if (cartTotal) {
        cartTotal.textContent = "₹" + total.toFixed(2);
    }
}

// Update cart quantity
function updateCartQuantity(productId, change) {
    const cart = getCart();

    const item = cart.find(
        entry => Number(entry.id) === Number(productId)
    );

    if (!item) {
        return;
    }

    const newQuantity =
        Number(item.quantity) + Number(change);

    if (newQuantity <= 0) {
        removeFromCart(productId);
        return;
    }

    const product = allProducts.find(
        entry => Number(entry.id) === Number(productId)
    );

    if (product && newQuantity > Number(product.stock)) {
        alert("Sorry, not enough stock available.");
        return;
    }

    item.quantity = newQuantity;
    saveCart(cart);
}

// Remove product from cart
function removeFromCart(productId) {
    const cart = getCart().filter(
        item => Number(item.id) !== Number(productId)
    );

    saveCart(cart);
}
// Customer registration
async function registerUser(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = Object.fromEntries(
        new FormData(form).entries()
    );

    try {
        const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        let result = {};

        try {
            result = await response.json();
        } catch {
            result = {};
        }

        if (!response.ok) {
            alert(
                result.message ||
                result.error ||
                "Registration failed."
            );
            return;
        }

        alert("Registration successful!");
        window.location.href = "/pages/login.html";

    } catch (error) {
        console.error("Registration error:", error);
        alert("Unable to register. Please try again.");
    }
}

// Customer login
async function loginUser(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = Object.fromEntries(
        new FormData(form).entries()
    );

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        let result = {};

        try {
            result = await response.json();
        } catch {
            result = {};
        }

        if (!response.ok) {
            alert(
                result.message ||
                result.error ||
                "Login failed."
            );
            return;
        }

        // Save the logged-in customer.
        localStorage.setItem(
            USER_KEY,
            JSON.stringify(result)
        );

        alert("Login successful!");

        // Return to the page requested before login, if available.
        const returnTo =
            sessionStorage.getItem("frostHavenReturnTo");

        sessionStorage.removeItem("frostHavenReturnTo");

        if (
            returnTo &&
            returnTo.startsWith("/") &&
            !returnTo.startsWith("//") &&
            !returnTo.startsWith("/admin/")
        ) {
            window.location.href = returnTo;
        } else {
            window.location.href = "/";
        }

    } catch (error) {
        console.error("Login error:", error);
        alert("Unable to log in. Please try again.");
    }
}
// Initialize customer pages
document.addEventListener("DOMContentLoaded", () => {
    updateCartCount();
    loadProducts();
    renderCart();

    // Category buttons
    document.querySelectorAll("[data-category]").forEach(button => {
        button.addEventListener("click", () => {
            document.querySelectorAll("[data-category]").forEach(btn => {
                btn.classList.toggle("active", btn === button);
            });

            filterProducts(button.dataset.category);
        });
    });

    // Product sorting
    const sortSelect = document.getElementById("sort-products");

    if (sortSelect) {
        sortSelect.addEventListener("change", () => {
            sortProducts(sortSelect.value);
        });
    }

    // Registration form
    const registerForm = document.getElementById("register-form");

    if (registerForm) {
        registerForm.addEventListener("submit", registerUser);
    }

    // Login form
    const loginForm = document.getElementById("login-form");

    if (loginForm) {
        loginForm.addEventListener("submit", loginUser);
    }
});

// Synchronize cart updates across browser tabs
window.addEventListener("storage", event => {
    if (event.key === CART_KEY) {
        updateCartCount();
        renderCart();
    }
});
// Admin order management
document.addEventListener("DOMContentLoaded", () => {
    const orderTable = document.getElementById("admin-order-list");
    const orderCount = document.getElementById("admin-order-count");
    const orderSearch = document.getElementById("order-search");
    const orderStatusFilter =
        document.getElementById("order-status-filter");
    const orderDetailsSection =
        document.getElementById("order-details-section");
    const orderDetails = document.getElementById("order-details");
    const closeOrderDetails =
        document.getElementById("close-order-details");

    // Run only on the admin orders page.
    if (
        !orderTable ||
        !orderCount ||
        !orderSearch ||
        !orderStatusFilter
    ) {
        return;
    }

    let adminOrders = [];

    // Read a value using possible API field names.
    function orderValue(order, ...keys) {
        for (const key of keys) {
            if (
                order[key] !== undefined &&
                order[key] !== null
            ) {
                return order[key];
            }
        }

        return null;
    }

    // Format order dates.
    function orderDate(value) {
        if (!value) {
            return "N/A";
        }

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? String(value)
            : date.toLocaleDateString("en-IN");
    }

    // Create safe table cells.
    function orderCell(value) {
        const td = document.createElement("td");

        td.textContent =
            value === undefined ||
            value === null ||
            value === ""
                ? "N/A"
                : String(value);

        return td;
    }

    // Display a message in the table.
    function showOrderMessage(message) {
        orderTable.replaceChildren();

        const row = document.createElement("tr");
        const td = document.createElement("td");

        td.colSpan = 8;
        td.textContent = message;

        row.appendChild(td);
        orderTable.appendChild(row);
    }

    // Show complete details for one order.
    function displayOrderDetails(order) {
        if (!orderDetails || !orderDetailsSection) {
            return;
        }

        orderDetails.replaceChildren();

        const fields = [
            [
                "Order ID",
                orderValue(order, "id", "orderId", "order_id")
            ],
            [
                "Customer",
                orderValue(
                    order,
                    "customerName",
                    "customer_name",
                    "name"
                )
            ],
            [
                "Customer Email",
                orderValue(
                    order,
                    "customerEmail",
                    "customer_email",
                    "email"
                )
            ],
            [
                "Date",
                orderDate(
                    orderValue(
                        order,
                        "orderDate",
                        "createdAt",
                        "created_at",
                        "date"
                    )
                )
            ],
            [
                "Items",
                orderValue(
                    order,
                    "items",
                    "itemCount",
                    "item_count"
                )
            ],
            [
                "Total",
                "₹" + Number(
                    orderValue(
                        order,
                        "totalAmount",
                        "total_amount",
                        "total"
                    ) || 0
                ).toFixed(2)
            ],
            [
                "Payment",
                orderValue(
                    order,
                    "paymentMethod",
                    "payment_method",
                    "paymentStatus",
                    "payment_status"
                )
            ],
            [
                "Status",
                orderValue(
                    order,
                    "orderStatus",
                    "order_status",
                    "status"
                ) || "Pending"
            ]
        ];

        fields.forEach(([label, value]) => {
            const paragraph = document.createElement("p");
            const strong = document.createElement("strong");

            strong.textContent = label + ": ";

            paragraph.appendChild(strong);
            paragraph.appendChild(
                document.createTextNode(
                    value === null || value === undefined
                        ? "N/A"
                        : String(value)
                )
            );

            orderDetails.appendChild(paragraph);
        });

        orderDetailsSection.hidden = false;

        orderDetailsSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    // Search and filter orders.
    function renderAdminOrders() {
        const term = orderSearch.value.trim().toLowerCase();
        const selectedStatus = orderStatusFilter.value;

        const filtered = adminOrders.filter(order => {
            const id = String(
                orderValue(order, "id", "orderId", "order_id") ?? ""
            ).toLowerCase();

            const customer = String(
                orderValue(
                    order,
                    "customerName",
                    "customer_name",
                    "name"
                ) ?? ""
            ).toLowerCase();

            const status = String(
                orderValue(
                    order,
                    "orderStatus",
                    "order_status",
                    "status"
                ) || "Pending"
            );

            const matchesSearch =
                id.includes(term) || customer.includes(term);

            const matchesStatus =
                selectedStatus === "all" ||
                status.toLowerCase() ===
                    selectedStatus.toLowerCase();

            return matchesSearch && matchesStatus;
        });

        orderCount.textContent =
            filtered.length + " of " + adminOrders.length + " Orders";

        orderTable.replaceChildren();

        if (!filtered.length) {
            showOrderMessage(
                adminOrders.length
                    ? "No orders match your search or status filter."
                    : "No orders found."
            );

            return;
        }

        filtered.forEach(order => {
            const row = document.createElement("tr");

            const id = orderValue(
                order,
                "id",
                "orderId",
                "order_id"
            );

            const customer = orderValue(
                order,
                "customerName",
                "customer_name",
                "name"
            );

            const date = orderValue(
                order,
                "orderDate",
                "createdAt",
                "created_at",
                "date"
            );

            const items = orderValue(
                order,
                "items",
                "itemCount",
                "item_count"
            );

            const total = orderValue(
                order,
                "totalAmount",
                "total_amount",
                "total"
            );

            const payment = orderValue(
                order,
                "paymentMethod",
                "payment_method",
                "paymentStatus",
                "payment_status"
            );

            const status = orderValue(
                order,
                "orderStatus",
                "order_status",
                "status"
            ) || "Pending";

            row.appendChild(
                orderCell(id === null ? "N/A" : "#" + id)
            );

            row.appendChild(orderCell(customer));
            row.appendChild(orderCell(orderDate(date)));
            row.appendChild(orderCell(items));

            row.appendChild(
                orderCell(
                    "₹" + Number(total || 0).toFixed(2)
                )
            );

            row.appendChild(orderCell(payment));

            const statusCell = document.createElement("td");
            const statusBadge = document.createElement("span");

            statusBadge.className = "status";
            statusBadge.textContent = status;

            statusCell.appendChild(statusBadge);
            row.appendChild(statusCell);

            const actionCell = document.createElement("td");
            const viewButton = document.createElement("button");

            viewButton.type = "button";
            viewButton.className = "secondary-button";
            viewButton.textContent = "View Details";

            viewButton.addEventListener("click", () => {
                displayOrderDetails(order);
            });

            actionCell.appendChild(viewButton);
            row.appendChild(actionCell);

            orderTable.appendChild(row);
        });
    }

    // Fetch orders from Spring Boot.
    async function loadAdminOrders() {
        orderCount.textContent = "Loading...";
        showOrderMessage("Loading orders...");

        try {
            const response = await fetch("/api/orders", {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                },
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error(
                    "Orders API returned HTTP " + response.status
                );
            }

            const data = await response.json();

            if (Array.isArray(data)) {
                adminOrders = data;
            } else if (Array.isArray(data.content)) {
                adminOrders = data.content;
            } else if (Array.isArray(data.data)) {
                adminOrders = data.data;
            } else if (Array.isArray(data.orders)) {
                adminOrders = data.orders;
            } else {
                throw new Error(
                    "The orders API did not return a list."
                );
            }

            renderAdminOrders();

        } catch (error) {
            console.error("Admin order loading error:", error);

            orderCount.textContent = "Unavailable";

            showOrderMessage(
                "Could not load orders: " + error.message
            );
        }
    }

    // Search and status-filter events.
    orderSearch.addEventListener(
        "input",
        renderAdminOrders
    );

    orderStatusFilter.addEventListener(
        "change",
        renderAdminOrders
    );

    // Close order details.
    if (closeOrderDetails && orderDetailsSection) {
        closeOrderDetails.addEventListener("click", () => {
            orderDetailsSection.hidden = true;
        });
    }

    loadAdminOrders();
});