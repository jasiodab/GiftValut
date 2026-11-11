<?php
$items = $items ?? [];
$settings = $settings ?? ['defaultProductView' => 'grid', 'currency' => 'PLN'];
$currency = (string) ($settings['currency'] ?? 'PLN');
?>
<div class="page-header">
  <div class="page-header-main">
    <h1 class="page-title">Koszyk</h1>
    <p class="page-desc">Rzeczy, które chcesz kupić. Dodaj je z listy produktów lub kategorii.</p>
  </div>
  <div class="page-actions">
    <?php if (!empty($items)): ?>
      <button class="btn btn-ghost btn-sm" type="button" id="clearCartBtn"><?= icon('trash-2') ?> Wyczyść koszyk</button>
    <?php endif; ?>
  </div>
</div>

<?php if (empty($items)): ?>
  <div class="empty-state">
    <div class="empty-icon"><?= icon('shopping-cart') ?></div>
    <h3>Twój koszyk jest pusty</h3>
    <p>Przeglądaj produkty i dodawaj te, które chcesz kupić, bezpośrednio do koszyka.</p>
    <div class="empty-action">
      <button class="btn btn-sm" type="button" id="quickAddCartBtn"><?= icon('shopping-bag') ?> Przejdź do produktów</button>
    </div>
  </div>
<?php else: ?>
  <div class="panel">
    <div class="panel-body">
      <div class="product-list" id="cartContainer">
        <?php foreach ($items as $item): ?>
          <?php
          $meta = status_meta($item['status'] ?? 'TO_BUY');
          $lineTotal = $item['currentPrice'] !== null ? $item['currentPrice'] * $item['quantity'] : null;
          ?>
          <article class="product-row" data-id="<?= e($item['id']) ?>" data-product-id="<?= e($item['productId']) ?>">
            <a class="product-row-link" href="<?= e(url('/products/' . $item['productId'])) ?>" aria-label="Otwórz <?= e($item['name']) ?>"></a>
            <label class="product-row-check">
              <input class="bulk-check" type="checkbox" value="<?= e($item['id']) ?>" aria-label="Zaznacz <?= e($item['name']) ?>">
            </label>
            <div class="product-row-thumb">
              <?php if ($item['imageUrl']): ?>
                <img src="<?= e(product_image_url($item['imageUrl'])) ?>" alt="" loading="lazy">
              <?php else: ?>
                <?= icon('gift') ?>
              <?php endif; ?>
            </div>
            <div class="product-row-body">
              <div class="product-row-name"><?= e($item['name']) ?></div>
              <div class="product-row-meta">
                <?php if ($item['categoryName']): ?>
                  <span class="cat-dot" style="background:<?= e($item['categoryColor'] ?? '#D9A3B0') ?>"></span>
                  <span><?= e($item['categoryName']) ?></span>
                  <span class="sep">·</span>
                <?php endif; ?>
                <span><?= e($item['storeName'] ?? 'Nieznany sklep') ?></span>
              </div>
            </div>
            <div class="product-row-side">
              <span class="status <?= e($meta['class']) ?>"><span class="dot"></span><?= e($meta['label']) ?></span>
              <?php if ($item['currentPrice'] !== null): ?>
                <div class="cart-line">
                  <span class="cart-qty"><?= e($item['quantity']) ?> × <?= e(format_money($item['currentPrice'], $currency)) ?></span>
                  <?php if ($lineTotal !== null): ?>
                    <span class="cart-total"><strong><?= e(format_money($lineTotal, $currency)) ?></strong></span>
                  <?php endif; ?>
                </div>
              <?php else: ?>
                <span class="cart-price">—</span>
              <?php endif; ?>
              <button class="icon-btn btn-remove" type="button" data-cart-id="<?= e($item['id']) ?>" title="Usuń z koszyka" aria-label="Usuń z koszyka"><?= icon('x') ?></button>
            </div>
          </article>
        <?php endforeach; ?>
      </div>

      <?php
      $grandTotal = 0.0;
      foreach ($items as $item) {
        if ($item['currentPrice'] !== null) {
          $grandTotal += $item['currentPrice'] * $item['quantity'];
        }
      }
      ?>
      <div class="cart-footer">
        <div class="cart-summary">
          <span>Razem:</span>
          <strong><?= e(format_money($grandTotal, $currency)) ?></strong>
        </div>
        <a class="btn" href="<?= e(url('/products')) ?>"><?= icon('arrow-right') ?> Kontynuuj zakupy</a>
      </div>
    </div>
  </div>
<?php endif; ?>
