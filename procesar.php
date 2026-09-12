<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Validar y limpiar las entradas
    $monto   = floatval($_POST['monto']);
    $meses   = intval($_POST['meses']);
    $interes_porcentaje = intval($_POST['interes']);

    // CORRECCIÓN: Arreglado el array de valores permitidos
    $valores_permitidos =;
    if (!in_array($interes_porcentaje, $valores_permitidos)) {
        die("Error: Tasa de interés no válida.");
    }

    // Cálculos (Fórmula de amortización simple)
    $tasa_mensual = $interes_porcentaje / 100;
    $total_interes = $monto * $tasa_mensual * $meses;
    $total_pagar   = $monto + $total_interes;
    $cuota_mensual = $total_pagar / $meses;
    $capital_mensual = $monto / $meses;
    $interes_mensual = $total_interes / $meses;
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Resultado del Préstamo</title>
    <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f9; padding: 20px; }
        .resultado-box { max-width: 600px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin: 0 auto 20px auto; }
        h2, h3 { color: #333; text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; background: white; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: center; }
        th { background-color: #007bff; color: white; }
        tr:nth-child(even) { background-color: #f2f2f2; }
        .btn-volver { display: block; width: 100px; margin: 20px auto; text-align: center; background: #333; color: white; padding: 10px; text-decoration: none; border-radius: 4px; }
        .btn-volver:hover { background: #555; }
    </style>
</head>
<body>

<div class="resultado-box">
    <h2>Resumen del Préstamo</h2>
    <p><strong>Monto Solicitado:</strong> $<?php echo number_format($monto, 2); ?></p>
    <p><strong>Tasa de Interés:</strong> <?php echo $interes_porcentaje; ?>% mensual</p>
    <p><strong>Plazo:</strong> <?php echo $meses; ?> meses</p>
    <p><strong>Total Intereses:</strong> $<?php echo number_format($total_interes, 2); ?></p>
    <p><strong>Total a Pagar:</strong> $<?php echo number_format($total_pagar, 2); ?></p>
    <p><strong>Cuota Mensual Fija:</strong> $<?php echo number_format($cuota_mensual, 2); ?></p>
</div>

<div style="max-width: 600px; margin: auto;">
    <h3>Tabla de Amortización</h3>
    <table>
        <thead>
            <tr>
                <th>Mes</th>
                <th>Cuota</th>
                <th>Capital</th>
                <th>Interés</th>
                <th>Saldo Restante</th>
            </tr>
        </thead>
        <tbody>
            <?php
            $saldo_restante = $total_pagar;
            for ($i = 1; $i <= $meses; $i++) {
                $saldo_restante -= $cuota_mensual;
                if ($i == $meses) {
                    $saldo_restante = 0;
                }
                echo "<tr>";
                echo "<td>" . $i . "</td>";
                echo "<td>$" . number_format($cuota_mensual, 2) . "</td>";
                echo "<td>$" . number_format($capital_mensual, 2) . "</td>";
                echo "<td>$" . number_format($interes_mensual, 2) . "</td>";
                echo "<td>$" . number_format(abs($saldo_restante), 2) . "</td>";
                echo "</tr>";
            }
            ?>
        </tbody>
    </table>
    
    <a href="index.html" class="btn-volver">Volver</a>
</div>

</body>
</html>
<?php
} else {
    header("Location: index.html");
    exit();
}
?>

