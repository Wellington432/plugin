<?php

use GlpiPlugin\Carbooking\Car;

include('../../../inc/includes.php');

Session::checkRight("carbooking::car", READ);

Html::header(
    Car::getTypeName(2),
    $_SERVER['PHP_SELF'],
    'tools',
    Car::class,
    'car'
);

Search::show(Car::class);

Html::footer();
